import {
  Component,
  computed,
  signal,
  ChangeDetectionStrategy,
} from "@angular/core";
import { MatButtonToggleModule } from "@angular/material/button-toggle";
import { MatIcon } from "@angular/material/icon";
import { ResponsiveImageComponent } from "../responsive-image/responsive-image.component";

interface Feature {
  id: string;
  icon: string;
  // Short switch label; the heading carries the benefit.
  title: string;
  heading: string;
  body: string;
  points: string[];
  imageSrc: string;
  imageAlt: string;
}

@Component({
  selector: "mkt-feature-switcher",
  imports: [MatButtonToggleModule, MatIcon, ResponsiveImageComponent],
  templateUrl: "./feature-switcher.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: "./feature-switcher.component.scss",
})
export class FeatureSwitcherComponent {
  protected readonly features: Feature[] = [
    {
      id: "error-tracking",
      icon: "breaking_news",
      title: "Errors",
      heading: "Every error, grouped and ready to fix.",
      body: "Report your website or application's exceptions, log messages, Content Security Policy violations, and more to one place to triage and resolve. GlitchTip works with Sentry's open source client SDKs to receive error data from your application.",
      points: [
        "Repeats of the same error grouped into one issue, with counts and trends",
        "Stack traces, breadcrumbs, tags, and release on every event",
        "Alerts by email or webhook when something new breaks",
      ],
      imageSrc: "assets/home/issues-list@1x.png",
      imageAlt: "Screenshot of GlitchTip Issues Page",
    },
    {
      id: "performance",
      icon: "avg_pace",
      title: "Performance",
      heading: "Find what is slow, without building dashboards.",
      body: "Find out where your app is slow. GlitchTip takes a simple, works out of the box approach. No dashboard building or metrics hunting. Just find your slowest web requests, database calls, and other transactions.",
      points: [
        "Your slowest requests, database calls, and transactions, ranked",
        "Works out of the box with the SDK you already use",
        "Traces from the same SDK that reports your errors",
      ],
      imageSrc: "assets/home/performance@1x.png",
      imageAlt: "Screenshot of GlitchTip Performance Page",
    },
    {
      id: "uptime",
      icon: "share_eta",
      title: "Uptime",
      heading: "Know the moment your site goes down.",
      body: "GlitchTip can ping your site and warn you when it's not responding. Or reverse it and send GlitchTip a request on schedule. If GlitchTip doesn't receive your ping, it sends you an alert via email or webhook.",
      points: [
        "Checks your URLs on the interval you choose",
        "Heartbeat monitors for cron jobs and background workers",
        "Alerts by email or webhook when a check fails",
      ],
      imageSrc: "assets/home/uptime-monitors@1x.png",
      imageAlt: "Screenshot of GlitchTip Uptime Monitors",
    },
    {
      id: "logs",
      icon: "text_snippet",
      title: "Logs",
      heading: "Your logs, right next to your errors.",
      body: "Search and filter your application logs alongside your errors and performance data. Keep everything in one place for faster debugging.",
      points: [
        "Search and filter your application logs",
        "Logs sit alongside your errors and performance data",
        "One place to debug instead of three tools",
      ],
      imageSrc: "assets/home/logs@1x.png",
      imageAlt: "Screenshot of GlitchTip Logs",
    },
  ];

  protected readonly active = signal(0);
  protected readonly current = computed(() => this.features[this.active()]);
}
