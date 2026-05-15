import type { BezierPoint } from "../../core/assets/structuredBezierPath";
import {
  dragPathEditControl,
  selectPathEditControl,
  setPathEditComponentAxisValue,
  type PathEditComponent,
  type PathEditControl,
  type PathEditDragModifiers,
  type PathEditDragState,
  type PathEditSession,
} from "./pathEditCore";

export type PathEditCommand =
  | {
      type: "selectControl";
      control: PathEditControl;
    }
  | {
      type: "dragControl";
      dragState: PathEditDragState;
      point: BezierPoint;
      modifiers?: PathEditDragModifiers;
    }
  | {
      type: "setComponentAxisValue";
      segmentId: string;
      component: PathEditComponent;
      axisIndex: number;
      value: number;
    };

export type PathEditCommandResult =
  | {
      ok: true;
      dragState?: PathEditDragState;
    }
  | {
      ok: false;
    };

export function applyPathEditCommand(
  session: PathEditSession,
  command: PathEditCommand,
): PathEditCommandResult {
  if (command.type === "selectControl") {
    return {
      ok: true,
      dragState: selectPathEditControl(session, command.control),
    };
  }

  if (command.type === "dragControl") {
    dragPathEditControl(session, command.dragState, command.point, command.modifiers);
    return { ok: true };
  }

  return {
    ok: setPathEditComponentAxisValue(
      session,
      command.segmentId,
      command.component,
      command.axisIndex,
      command.value,
    ),
  };
}
