import {
  Injectable,
  computed,
  inject,
  linkedSignal,
  resource,
  signal,
} from "@angular/core";
import { Router } from "@angular/router";
import { MatSnackBar } from "@angular/material/snack-bar";
import {
  IssueStatus,
  Request,
  AnnotatedRequest,
  CSP,
  Message,
  EntryType,
  BreadcrumbValueData,
  ExceptionValueData,
  Values,
  IssueTags,
  IssueTagsAdjusted,
} from "../interfaces";
import { OrganizationsService } from "src/app/api/organizations.service";
import { StatefulService } from "src/app/shared/stateful-service/signal-state.service";
import { client } from "src/app/shared/api/api";
import { getCursor } from "src/app/shared/pagination.utils";
import { components } from "src/app/api/api-schema";
import { rawTrace } from "./event-detail/event-format";

type EventDetail = components["schemas"]["IssueEventDetailSchema"];
type IssueDetail = components["schemas"]["IssueDetailSchema"];
type IssueEventSummary = components["schemas"]["IssueEventSchema"];

/** One of an issue's events, as the event switcher lists it. */
export type RecentEvent = Pick<
  IssueEventSummary,
  "id" | "eventID" | "dateCreated" | "tags" | "user"
>;

/** Recent events of one issue, newest first. */
export interface RecentEvents {
  issueID: string;
  events: RecentEvent[];
  /** Next page cursor; null once every event is loaded. */
  cursor: string | null;
  loading: boolean;
  /** The last page failed to load; opening the switcher again retries. */
  failed: boolean;
}

const RECENT_EVENTS_PAGE = 20;

interface IssueDetailState {
  isReversed: boolean;
}

const initialState: IssueDetailState = {
  isReversed: true,
};

/** localStorage: "false" when the reader wants frames oldest first. */
const NEWEST_FIRST_KEY = "issueFramesNewestFirst";

function readNewestFirst(): boolean {
  try {
    return localStorage.getItem(NEWEST_FIRST_KEY) !== "false";
  } catch {
    return true;
  }
}

/** Tag keys that identify a user, in order of preference. */
const USER_TAG_KEYS = ["user.id", "user.email", "user.username", "user.ip"];

/** The events list sends snake_case keys although its schema says camelCase. */
function toRecentEvent(e: IssueEventSummary): RecentEvent {
  const raw = e as IssueEventSummary & {
    event_id?: string;
    date_created?: string;
  };
  return {
    id: e.id,
    eventID: e.eventID ?? raw.event_id ?? e.id,
    dateCreated: e.dateCreated ?? raw.date_created,
    tags: e.tags,
    user: e.user,
  };
}

export interface LoadedEvent<T> {
  value: T | null | undefined;
  loading: boolean;
  issueID: string | null;
}

/** Keeps the shown event while the next one of the same issue loads, so Older and Newer do not blank the page. */
export function holdWhileLoading<T>(
  next: LoadedEvent<T>,
  prev: { source: LoadedEvent<T>; value: T | null | undefined } | undefined,
): T | null | undefined {
  return next.value === undefined &&
    next.loading &&
    prev?.source.issueID === next.issueID
    ? prev.value
    : next.value;
}

@Injectable({
  providedIn: "root",
})
export class IssueDetailService extends StatefulService<IssueDetailState> {
  private organization = inject(OrganizationsService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  readonly issue = computed(() => this.#issueResource.value());
  readonly issueInitialLoadComplete = computed(() =>
    this.#issueResource.hasValue(),
  );
  readonly #shownEvent = linkedSignal<
    LoadedEvent<EventDetail>,
    EventDetail | null | undefined
  >({
    source: () => ({
      value: this.#eventResource.value(),
      loading: this.#eventResource.isLoading(),
      issueID: this.issueID(),
    }),
    computation: (next, prev) => holdWhileLoading(next, prev),
  });
  readonly event = this.#shownEvent.asReadonly();
  private readonly rawTags = computed(() =>
    this.#tagsResource.hasValue() ? this.#tagsResource.value() : null,
  );
  readonly tags = computed(() => {
    const tags = this.rawTags();
    return tags && this.tagsWithPercent(tags);
  });
  readonly eventInitialLoadComplete = computed(() =>
    this.#eventResource.hasValue(),
  );
  readonly isReversed = computed(() => this.state().isReversed);
  readonly hasNextEvent = computed(
    () => this.event() && this.event()?.nextEventID !== null,
  );
  readonly hasPreviousEvent = computed(
    () => this.event() && this.event()?.previousEventID !== null,
  );
  readonly nextEventUrl = computed(() => {
    const orgSlug = this.organization.activeOrganizationSlug();
    const issue = this.issue();
    const event = this.event();

    if (event && event.nextEventID) {
      return this.eventUrl(orgSlug, issue!, event.nextEventID);
    }
    return null;
  });
  readonly previousEventUrl = computed(() => {
    const orgSlug = this.organization.activeOrganizationSlug();
    const issue = this.issue();
    const event = this.event();

    if (event && event.previousEventID) {
      return this.eventUrl(orgSlug, issue!, event.previousEventID);
    }
    return null;
  });
  /** Thrown exception first, its causes under it, root cause last. */
  readonly exceptionChain = computed<Values[]>(() => {
    const entry = this.event()?.entries?.find((e) => e.type === "exception");
    const values = (entry?.data as ExceptionValueData | undefined)?.values;
    return [...(values ?? [])].reverse();
  });
  /** Raw view, Copy trace and the event menu share this text. */
  readonly exceptionTrace = computed(() => {
    const chain = this.exceptionChain();
    return chain.length ? rawTrace(chain, this.event()?.platform) : "";
  });
  readonly eventEntryRequest = computed(() => {
    const event = this.event();
    return event ? this.getEntryRequestData(event) : undefined;
  });
  readonly eventEntryCSP = computed(() => {
    const event = this.event();
    return event ? this.getEventEntryCSP(event) : undefined;
  });
  readonly eventEntryMessage = computed(() => {
    const event = this.event();
    return event ? this.getEventEntryMessage(event) : undefined;
  });
  readonly breadcrumbs = computed(() => {
    const event = this.event();
    return event ? this.eventEntryBreadcrumbs(event) : undefined;
  });

  /** Distinct users from the issue's user tag (the API userCount is unfilled). */
  readonly userCount = computed(() => {
    const tags = this.rawTags();
    if (!tags) return null;
    for (const key of USER_TAG_KEYS) {
      const tag = tags.find((t) => t.key === key);
      if (tag) {
        return { count: tag.uniqueValues, key, tagged: tag.totalValues };
      }
    }
    return null;
  });

  issueID = signal("");
  eventID = signal<string | null>(null);

  /** Loaded when the event switcher first opens; kept while the issue is open. */
  readonly recentEvents = signal<RecentEvents | null>(null);

  /** Loads the first page, or the next one when `more` is set. */
  async loadRecentEvents(more = false) {
    const issueID = this.issueID();
    const current = this.recentEvents();
    const same = current?.issueID === issueID;
    if (!issueID || (same && current.loading)) return;
    if (same && !more && !current.failed) return;
    const cursor = more && same ? current.cursor : null;
    if (more && !cursor) return;
    const kept = more && same ? current.events : [];
    const state = {
      issueID,
      events: kept,
      cursor,
      loading: true,
      failed: false,
    };
    this.recentEvents.set(state);
    let page: RecentEvent[] | null = null;
    let next: string | null = null;
    try {
      const { data, response } = await client.GET(
        "/api/0/issues/{issue_id}/events/",
        {
          params: {
            path: { issue_id: parseInt(issueID) },
            query: { limit: RECENT_EVENTS_PAGE, cursor },
          },
        },
      );
      page = data ? data.map(toRecentEvent) : null;
      // No Link header means no further pages.
      if (data?.length && response.headers.has("link")) {
        next = getCursor(response);
      }
    } catch {
      // A network error leaves page null, so the switcher offers a retry.
    }
    // A newer load or another issue took over meanwhile.
    if (this.recentEvents() !== state) return;
    const seen = new Set(kept.map((e) => e.id));
    this.recentEvents.set({
      issueID,
      events: [...kept, ...(page ?? []).filter((e) => !seen.has(e.id))],
      cursor: page ? next : cursor,
      loading: false,
      failed: !page,
    });
  }

  /** The route of one of this issue's events, as Older and Newer use. */
  eventUrlFor(eventID: string) {
    return this.eventUrl(
      this.organization.activeOrganizationSlug(),
      this.issue() ?? null,
      eventID,
    );
  }

  #issueResource = resource({
    params: () => ({ issueID: this.issueID() }),
    loader: async ({ params }) => {
      if (!params.issueID) {
        return;
      }
      const { data } = await client.GET("/api/0/issues/{issue_id}/", {
        params: { path: { issue_id: parseInt(params.issueID) } },
      });
      // null, not undefined: a missing issue is a loaded value (not found).
      return data ?? null;
    },
  });
  #tagsResource = resource({
    params: () => ({ issueID: this.issueID() }),
    loader: async ({ params }) => {
      if (!+params.issueID) return null;
      const { data } = await client.GET("/api/0/issues/{issue_id}/tags/", {
        params: { path: { issue_id: +params.issueID } },
      });
      return (data as IssueTags[] | undefined) ?? null;
    },
  });
  #eventResource = resource({
    params: () => ({ issueID: this.issueID(), eventID: this.eventID() }),
    loader: async ({ params }) => {
      const issueID = parseInt(params.issueID);
      const eventID = params.eventID;
      if (!issueID) {
        return undefined;
      }
      if (eventID) {
        const { data } = await client.GET(
          "/api/0/issues/{issue_id}/events/{event_id}/",
          {
            params: {
              path: { issue_id: issueID, event_id: eventID },
            },
          },
        );
        return data ?? null;
      }
      const { data } = await client.GET(
        "/api/0/issues/{issue_id}/events/latest/",
        {
          params: { path: { issue_id: issueID } },
        },
      );
      return data ?? null;
    },
  });

  constructor() {
    super(initialState);
    this.setState({ isReversed: readNewestFirst() });
  }

  /** The frame order is the reader's choice, so it survives a new issue. */
  override clearState() {
    super.clearState();
    this.setState({ isReversed: readNewestFirst() });
    this.recentEvents.set(null);
  }

  setNewestFirst(newestFirst: boolean) {
    this.setState({ isReversed: newestFirst });
    try {
      localStorage.setItem(NEWEST_FIRST_KEY, String(newestFirst));
    } catch {
      // The order still applies for this visit.
    }
  }

  async setStatus(
    status: IssueStatus,
    statusDetails?: components["schemas"]["StatusDetailsSchema"],
  ) {
    const issue = this.issue();
    if (issue) {
      const body: components["schemas"]["UpdateIssueSchema"] = { status };
      if (statusDetails) {
        body.statusDetails = statusDetails;
      }
      const { data, error } = await client.PUT(
        "/api/0/organizations/{organization_id_or_slug}/issues/{issue_id}/",
        {
          params: {
            path: {
              ...this.organization.orgPath(
                this.organization.activeOrganizationSlug(),
              ),
              issue_id: parseInt(this.issueID()),
            },
          },
          body,
        },
      );
      if (error) {
        this.snackBar.open($localize`Error, unable to update issue`);
      }
      if (data) {
        const resolvedInRelease = data.statusDetails?.["inRelease"];
        this.#issueResource.update((issue) => ({
          ...issue!,
          status: data.status as IssueStatus,
          statusDetails: data.statusDetails ?? {},
        }));
        if (statusDetails?.inNextRelease) {
          this.snackBar.open(
            resolvedInRelease
              ? $localize`Issue will be resolved as of release ${resolvedInRelease}.`
              : $localize`Issue resolved. No release was found to tie it to.`,
          );
        }
      }
    }
  }

  updateCommentCount(num: number) {
    this.setUpdatedCommentCount(num);
  }

  async deleteIssue(id: string) {
    const { error } = await client.DELETE("/api/0/issues/{issue_id}/", {
      params: { path: { issue_id: parseInt(id) } },
    });
    if (error) {
      this.snackBar.open(
        `There was an error deleting this issue. Please try again.`,
      );
    } else {
      this.snackBar.open($localize`Issue ${id} has been deleted.`);
      this.router.navigate([
        this.organization.activeOrganizationSlug(),
        "issues",
      ]);
    }
  }

  private tagsWithPercent(tags: IssueTags[]): IssueTagsAdjusted[] | undefined {
    if (tags.length > 0) {
      const tagsWithExtraData = tags.map((tag) => {
        const totalValues = tag.totalValues;
        const limitedTopValues = tag.topValues.slice(0, 10);
        const tagWithPercent = limitedTopValues.map((topValue) => {
          const count = topValue.count;
          const percent = (count / totalValues) * 100;
          const percentRounded = Math.round(percent);
          /** percent is to add up for total percent and percentRounded is for display */
          return {
            ...topValue,
            percentRounded,
            percent,
          };
        });
        const sumOfPercents = tagWithPercent.reduce(
          (accum, item) => accum + item.percent,
          0,
        );
        if (sumOfPercents < 100) {
          return {
            ...tag,
            topValues: tagWithPercent,
            other: Math.round(100 - sumOfPercents),
          };
        } else {
          return { ...tag, topValues: tagWithPercent };
        }
      });

      return [...tagsWithExtraData];
    }
    return;
  }

  private setUpdatedCommentCount(num: number) {
    this.#issueResource.update((issue) => ({
      ...issue!,
      numComments: issue!.numComments + num,
    }));
  }

  /* Return the message entry type for an event */
  private getEventEntryMessage(event: EventDetail): Message | undefined {
    const eventMessage = this.getMessageEntryData(event);

    if (eventMessage) {
      return { ...eventMessage };
    }
    return;
  }

  /* Return the CSP entry type for an event */
  private getEventEntryCSP(event: EventDetail): CSP | undefined {
    const eventCSP = this.getCspEntryData(event);

    if (eventCSP) {
      return { ...eventCSP };
    }
    return;
  }

  /* Return the breadcrumbs entry type for an event */
  private eventEntryBreadcrumbs(
    event: EventDetail,
  ): BreadcrumbValueData | undefined {
    const breadcrumbs = this.getBreadcrumbs(event);
    if (breadcrumbs) {
      return { ...breadcrumbs };
    }
    return;
  }

  /* Return the request entry type for an event with additional fields parsed from url */
  private getEntryRequestData(
    event: EventDetail,
  ): AnnotatedRequest | undefined {
    const eventRequest = this.getRequestEntryData(event);
    if (!eventRequest) return;
    let path = eventRequest.url;
    try {
      path = new URL(eventRequest.url).pathname;
    } catch {
      // Not an absolute URL: show it as sent.
    }
    return { ...eventRequest, path };
  }

  /**
   * We had some methods above that looked a bit daunting; one way to make them
   * less daunting was to get the ugly-looking typecasting out of the way.
   *
   * So here are a few helper functions that funnel into getEntryData and return
   * data which is typed the way we want.
   */
  private getMessageEntryData(event: EventDetail) {
    return this.getEntryData(event, "message") as Message | undefined;
  }

  private getCspEntryData(event: EventDetail) {
    return this.getEntryData(event, "csp") as CSP | undefined;
  }

  private getRequestEntryData(event: EventDetail) {
    return this.getEntryData(event, "request") as Request | undefined;
  }

  private getBreadcrumbs(event: EventDetail) {
    return this.getEntryData(event, "breadcrumbs") as
      | BreadcrumbValueData
      | undefined;
  }

  /**
   * Regardless of what kind of entry it is, we want to return the `data`
   * property or undefined
   */
  private getEntryData(event: EventDetail, entryType: EntryType) {
    const entries = event.entries!.find((entry) => entry.type === entryType);
    if (!entries) {
      return undefined;
    }
    return entries.data;
  }

  /** Build event detail url string */
  private eventUrl(
    orgSlug: string | null,
    issue: IssueDetail | null,
    eventID: string,
  ) {
    if (orgSlug && issue) {
      return `/${orgSlug}/issues/${issue.id}/events/${eventID}`;
    }
    return null;
  }
}
