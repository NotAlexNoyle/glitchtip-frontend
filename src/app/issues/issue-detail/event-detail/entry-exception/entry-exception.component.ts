import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from "@angular/core";
import { NgTemplateOutlet } from "@angular/common";
import { ClipboardModule } from "@angular/cdk/clipboard";
import { MatButtonModule } from "@angular/material/button";
import { MatButtonToggleModule } from "@angular/material/button-toggle";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatSnackBar } from "@angular/material/snack-bar";
import { PanelComponent } from "src/app/shared/panel/panel.component";
import { StatusPillComponent } from "src/app/shared/status-pill/status-pill.component";
import {
  GhostSelectComponent,
  GhostSelectOption,
} from "src/app/shared/ghost-select/ghost-select.component";
import { codeLanguage, highlightLines } from "src/app/prismjs/highlight-lines";
import { IssueDetailService } from "../../issue-detail.service";
import { Frame, Values } from "../../../interfaces";
import {
  PropertyRow,
  frameDisplay,
  frameLineCol,
  framePackage,
  hideFunctionName,
  isHttpUrl,
  packageOf,
  stackFrames,
  toRows,
  toggled,
} from "../event-format";

interface FrameItem {
  kind: "frame";
  key: string;
  frame: Frame;
  fn: string;
  file: string;
  /** The full path or file name behind a shortened display. */
  fileTip: string;
  lc: string;
  /** absPath, when it says more than the displayed file. */
  abs: string;
  absIsUrl: boolean;
  /** The file name, when the row shows the module instead. */
  filename: string;
  pkg: string;
  muted: boolean;
}

/** What an open frame shows; built on first open. */
interface FrameBody {
  /** Context lines as token HTML; null shows plain text. */
  code: string[] | null;
  vars: PropertyRow[];
}

interface RunItem {
  kind: "run";
  key: string;
  packages: string;
  frames: FrameItem[];
}

interface FrameView {
  list: (FrameItem | RunItem)[];
  hidden: number;
}

interface Mechanism {
  type: string;
  handled: boolean;
  fn: string;
}

interface ChainLink {
  key: string;
  role: string;
  type: string;
  value: string;
  unhandled: boolean;
  /** Null when it says nothing new (a plain chained link). */
  mechanism: Mechanism | null;
  root: boolean;
  top: FrameItem | undefined;
  frames: FrameItem[];
}

/** Items shown before "Show N more frames". */
const FRAME_CAP = 10;

const linkKey = (i: number) => `l${i}`;
const frameKey = (link: number, frame: number) => `f${link}-${frame}`;

/** The most recent app frame, else the most recent frame (API index). */
function topFrameIndex(frames: Frame[]): number {
  for (let i = frames.length - 1; i >= 0; i--) {
    if (frames[i].inApp) return i;
  }
  return frames.length - 1;
}

function mechanismOf(mech: Values["mechanism"]): Mechanism | null {
  if (!mech) return null;
  const fn = mech.data?.function ?? "";
  if (mech.type === "chained" && mech.handled !== false && !fn) return null;
  return { type: mech.type ?? "", handled: mech.handled !== false, fn };
}

@Component({
  selector: "gt-entry-exception",
  templateUrl: "./entry-exception.component.html",
  styleUrls: ["./entry-exception.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PanelComponent,
    StatusPillComponent,
    GhostSelectComponent,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    ClipboardModule,
    NgTemplateOutlet,
    MatButtonToggleModule,
  ],
})
export class EntryExceptionComponent {
  private issueService = inject(IssueDetailService);
  private snackBar = inject(MatSnackBar);

  readonly mode = signal<"app" | "all" | "raw">("app");
  readonly unhandledLabel = $localize`unhandled`;

  readonly orders: GhostSelectOption[] = [
    { value: "newest", label: $localize`Most recent first` },
    { value: "oldest", label: $localize`Most recent last` },
  ];
  readonly order = computed(() =>
    this.issueService.isReversed() ? "newest" : "oldest",
  );
  readonly orderShort = computed(() =>
    this.order() === "newest" ? $localize`Newest` : $localize`Oldest`,
  );

  private readonly values = this.issueService.exceptionChain;
  readonly raw = this.issueService.exceptionTrace;
  readonly single = computed(() => this.values().length === 1);
  /** Without frames there is nothing to filter, order or show raw. */
  readonly hasFrames = computed(() =>
    this.values().some((v) => stackFrames(v).length),
  );
  /** The view on screen; a frameless exception always shows its links. */
  readonly view = computed(() => (this.hasFrames() ? this.mode() : "app"));

  /** Frames keep their stack index as key, so reordering keeps them open. */
  readonly chain = computed<ChainLink[]>(() => {
    const values = this.values();
    const last = values.length - 1;
    const platform = this.issueService.event()?.platform;
    const newestFirst = this.issueService.isReversed();
    return values.map((value, i) => {
      const stack = stackFrames(value);
      const items = stack.map((frame, fi) =>
        this.frameItem(frame, frameKey(i, fi), platform),
      );
      return {
        key: linkKey(i),
        role:
          i === 0
            ? $localize`Thrown`
            : i === last
              ? $localize`Root cause`
              : $localize`Caused by`,
        type: value.type,
        value: value.value || "",
        unhandled: value.mechanism?.handled === false,
        mechanism: mechanismOf(value.mechanism),
        root: i === last && last > 0,
        top: items[topFrameIndex(stack)],
        frames: newestFirst ? [...items].reverse() : items,
      };
    });
  });

  /** One exception names its type in the header and its value in the body. */
  readonly title = computed(() =>
    this.single()
      ? this.values()[0].type || $localize`Exception`
      : $localize`Exception`,
  );

  readonly subtitle = computed(() => {
    const n = this.values().length;
    return n > 1 ? $localize`${n}:count: in chain, thrown first` : "";
  });

  /** The root cause opens on its top app frame. */
  private readonly defaultOpen = computed(() => {
    const values = this.values();
    const last = values.length - 1;
    const open = new Set<string>();
    if (last < 0) return open;
    if (last > 0) open.add(linkKey(last));
    const stack = stackFrames(values[last]);
    if (stack.length) open.add(frameKey(last, topFrameIndex(stack)));
    return open;
  });
  readonly opened = linkedSignal(() => this.defaultOpen());
  private readonly showAllFrames = linkedSignal(() => {
    this.values();
    return new Set<string>();
  });

  /**
   * Per link: app frames stand alone and each run of library frames folds
   * into one row; Full (or a link with no app frames) lists every frame.
   */
  readonly views = computed(() => {
    const full = this.view() === "all";
    const showAll = this.showAllFrames();
    const views = new Map<string, FrameView>();
    for (const link of this.chain()) {
      const all = full || !link.frames.some((f) => f.frame.inApp);
      const list: (FrameItem | RunItem)[] = [];
      for (const item of link.frames) {
        const last = list[list.length - 1];
        if (item.frame.inApp || all) {
          list.push(item);
        } else if (last?.kind === "run") {
          last.frames.push(item);
        } else {
          list.push({
            kind: "run",
            key: "r" + item.key,
            packages: "",
            frames: [item],
          });
        }
      }
      for (const it of list) {
        if (it.kind === "run") {
          const pkgs = it.frames.map((f) => packageOf(f.frame));
          it.packages = [...new Set(pkgs.filter(Boolean))].join(", ");
        }
      }
      const capped = list.length > FRAME_CAP + 2 && !showAll.has(link.key);
      views.set(
        link.key,
        capped
          ? { list: list.slice(0, FRAME_CAP), hidden: list.length - FRAME_CAP }
          : { list, hidden: 0 },
      );
    }
    return views;
  });

  private readonly frameItems = computed(() => {
    const byKey = new Map<string, FrameItem>();
    for (const link of this.chain()) {
      for (const f of link.frames) byKey.set(f.key, f);
    }
    return byKey;
  });
  private readonly bodyCache = new WeakMap<Frame, FrameBody>();

  /** Source highlighting and vars only for the frames that are open. */
  readonly bodies = computed(() => {
    const platform = this.issueService.event()?.platform;
    const items = this.frameItems();
    const bodies = new Map<string, FrameBody>();
    for (const key of this.opened()) {
      const item = items.get(key);
      if (item) bodies.set(key, this.frameBody(item.frame, platform));
    }
    return bodies;
  });

  toggle(key: string) {
    this.opened.set(toggled(this.opened(), key));
  }

  showMore(linkKey: string) {
    this.showAllFrames.update((s) => new Set(s).add(linkKey));
  }

  setOrder(value: string) {
    this.issueService.setNewestFirst(value === "newest");
  }

  onCopied() {
    this.snackBar.open($localize`Trace copied`);
  }

  private frameBody(
    frame: Frame,
    platform: string | null | undefined,
  ): FrameBody {
    let body = this.bodyCache.get(frame);
    if (!body) {
      const lines = (frame.context ?? []).map((l) =>
        String(l[1] ?? "").replace(/\r?\n$/, ""),
      );
      body = {
        code: highlightLines(
          lines,
          codeLanguage(frame.filename || frame.absPath, platform),
        ),
        vars: toRows(frame.vars),
      };
      this.bodyCache.set(frame, body);
    }
    return body;
  }

  private frameItem(
    frame: Frame,
    key: string,
    platform: string | null | undefined,
  ): FrameItem {
    const file = frameDisplay(frame, platform);
    const showsModule = !!frame.module && file === frame.module;
    const abs = frame.absPath && frame.absPath !== file ? frame.absPath : "";
    return {
      kind: "frame",
      key,
      frame,
      fn: hideFunctionName(frame, platform)
        ? ""
        : frame.function || frame.symbol || "?",
      file,
      fileTip: abs || (showsModule && frame.filename ? frame.filename : ""),
      lc: frameLineCol(frame),
      abs,
      absIsUrl: isHttpUrl(abs),
      filename:
        showsModule && frame.filename && frame.filename !== file
          ? frame.filename
          : "",
      pkg: framePackage(frame, platform),
      muted: !frame.inApp,
    };
  }
}
