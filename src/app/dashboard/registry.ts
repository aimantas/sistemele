import { clientModules } from "@/modules/client";
import type { WidgetDefinition } from "@/modules/types.client";
import { coreWidgets } from "./core-widgets";

/** Every widget available in this installation: core + enabled modules. */
export const widgetRegistry: WidgetDefinition[] = [...coreWidgets, ...clientModules.flatMap((module) => module.widgets ?? [])];

const byType = new Map(widgetRegistry.map((widget) => [widget.type, widget]));

export function findWidget(type: string): WidgetDefinition | undefined {
  return byType.get(type);
}

export const widgetTypes = new Set(byType.keys());
