import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  input,
} from "@angular/core";
import { IssueDetailService } from "../issue-detail.service";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatCardModule } from "@angular/material/card";
import { NgStyle } from "@angular/common";
import { PercentComponent } from "src/app/shared/object-attributes/percent.component";

@Component({
  selector: "gt-issue-detail-tags",
  templateUrl: "./issue-detail-tags.component.html",
  styleUrls: ["./issue-detail-tags.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, NgStyle, MatTooltipModule, PercentComponent],
})
export class IssueDetailTagsComponent implements OnInit {
  private issueService = inject(IssueDetailService);

  tags = this.issueService.tags;
  issueID = input.required<string>();

  ngOnInit() {
    this.issueService.retrieveTags(+this.issueID());
  }
}
