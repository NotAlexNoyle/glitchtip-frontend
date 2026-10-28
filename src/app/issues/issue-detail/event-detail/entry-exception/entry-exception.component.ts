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
import { ExceptionValueData, Frame, Values } from "../../../interfaces";
import {
  PropertyRow,
  frameDisplay,
  frameLineCol,
  framePackage,
  framesInOrder,
  hideFunctionName,
  isHttpUrl,
  packageOf,
  rawTrace,
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
  vars: PropertyRow[];
  /** Context lines as token HTML; null shows plain text. */
  code: string[] | null;
}

interface RunItem {
  kind: "run";
  key: string;
  label: string;
  frames: FrameItem[];
}

interface FrameView {
  list: (FrameItem | RunItem)[];
  hidden: number;
}

interface ChainLink {
  key: string;
  role: string;
  type: string;
  value: string;
  unhandled: boolean;
  /** "mechanism X · handled no · function Y", or empty. */
  mechanism: string;
  root: boolean;
  top: FrameItem | undefined;
  frames: FrameItem[];
}

/** Items shown before "Show N more frames". */
const FRAME_CAP = 10;

const FULL = $localize`Full`;
const RAW = $localize`Raw`;

/** A plain chained link says nothing new, so it gets no mechanism line. */
function mechanismLine(mech: Values["mechanism"]): string {
  if (!mech) return "";
  const fn = mech.data?.function;
  if (mech.type === "chained" && mech.handled !== false && !fn) return "";
  return [
    mech.type ? $localize`mechanism ${mech.type}` : "",
    mech.handled === false ? $localize`handled no` : $localize`handled yes`,
    fn ? $localize`function ${fn}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function runLabel(frames: FrameItem[]): string {
  const pkgs = [
    ...new Set(frames.map((f) => packageOf(f.frame)).filter(Boolean)),
  ];
  const n = frames.length;
  const count =
    n === 1 ? $localize`1 library frame` : $localize`${n} library frames`;
  return pkgs.length ? `${count} · ${pkgs.join(", ")}` : count;
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
  ],
})
export class EntryExceptionComponent {
  private issueService = inject(IssueDetailService);
  private snackBar = inject(MatSnackBar);

  readonly modes: GhostSelectOption[] = [
    { value: "app", label: $localize`App frames` },
    { value: "all", label: FULL },
    { value: "raw", label: RAW },
  ];
  readonly mode = signal("app");
  readonly modeShort = computed(
    () => ({ app: $localize`App`, all: FULL, raw: RAW })[this.mode()] ?? "",
  );
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

  /** Thrown exception first, its causes under it, root cause last. */
  private readonly values = computed<Values[]>(() => {
    const event = this.issueService.event();
    const entry = event?.entries?.find((e) => e.type === "exception");
    const values = (entry?.data as ExceptionValueData | undefined)?.values;
    return [...(values ?? [])].reverse();
  });

  readonly single = computed(() => this.values().length === 1);

  readonly chain = computed<ChainLink[]>(() => {
    const values = this.values();
    const last = values.length - 1;
    const platform = this.issueService.event()?.platform;
    const newestFirst = this.issueService.isReversed();
    return values.map((value, i) => {
      const frames = framesInOrder(value, newestFirst).map((frame, fi) =>
        this.frameItem(frame, `f${i}-${fi}`, platform),
      );
      const mech = value.mechanism;
      return {
        key: `l${i}`,
        role:
          i === 0
            ? $localize`Thrown`
            : i === last
              ? $localize`Root cause`
              : $localize`Caused by`,
        type: value.type,
        value: value.value || "",
        unhandled: !!mech && mech.handled === false,
        mechanism: mechanismLine(mech),
        root: i === last && last > 0,
        top: frames.find((f) => f.frame.inApp) ?? frames[0],
        frames,
      };
    });
  });

  /** One exception puts its type and value in the panel header. */
  readonly title = computed(() =>
    this.single()
      ? this.chain()[0]?.type || $localize`Exception`
      : $localize`Exception`,
  );

  readonly subtitle = computed(() => {
    const n = this.values().length;
    if (n === 1) return this.chain()[0].value;
    return n ? $localize`${n} in chain, thrown first` : "";
  });

  /** The root cause opens on its top app frame. */
  private readonly defaultOpen = computed(() => {
    const chain = this.chain();
    const root = chain[chain.length - 1];
    const open = new Set<string>();
    if (!root) return open;
    if (chain.length > 1) open.add(root.key);
    if (root.top) open.add(root.top.key);
    return open;
  });
  readonly opened = linkedSignal(() => this.defaultOpen());
  private readonly showAllFrames = linkedSignal(() => {
    this.defaultOpen();
    return new Set<string>();
  });

  /**
   * Per link: app frames stand alone and each run of library frames folds
   * into one row; Full (or a link with no app frames) lists every frame.
   */
  readonly views = computed(() => {
    const full = this.mode() === "all";
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
            label: "",
            frames: [item],
          });
        }
      }
      for (const it of list) {
        if (it.kind === "run") it.label = runLabel(it.frames);
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

  readonly raw = computed(() =>
    rawTrace(this.values(), this.issueService.event()?.platform),
  );

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

  private frameItem(
    frame: Frame,
    key: string,
    platform: string | null | undefined,
  ): FrameItem {
    const lines = (frame.context ?? []).map((l) =>
      String(l[1] ?? "").replace(/\r?\n$/, ""),
    );
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
      vars: toRows(frame.vars),
      code: highlightLines(
        lines,
        codeLanguage(frame.filename || frame.absPath, platform),
      ),
    };
  }
}
