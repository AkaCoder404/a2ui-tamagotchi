/**
 * A2UI Surface Store
 * Manages multiple surfaces, their component maps, and data models.
 */

import {
  type Surface,
  type A2Component,
  type DataModelEntry,
  type ServerMessage,
} from './types';

export class SurfaceStore {
  private surfaces = new Map<string, Surface>();
  private listeners = new Set<() => void>();

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  getSurface(id: string): Surface | undefined {
    return this.surfaces.get(id);
  }

  getAllSurfaces(): Surface[] {
    return Array.from(this.surfaces.values());
  }

  processMessage(msg: ServerMessage) {
    if ('surfaceUpdate' in msg) {
      this.handleSurfaceUpdate(msg.surfaceUpdate);
    } else if ('dataModelUpdate' in msg) {
      this.handleDataModelUpdate(msg.dataModelUpdate);
    } else if ('beginRendering' in msg) {
      this.handleBeginRendering(msg.beginRendering);
    } else if ('deleteSurface' in msg) {
      this.handleDeleteSurface(msg.deleteSurface);
    }
    this.emit();
  }

  private ensureSurface(surfaceId: string): Surface {
    if (!this.surfaces.has(surfaceId)) {
      this.surfaces.set(surfaceId, {
        surfaceId,
        componentMap: new Map(),
        dataModel: {},
        rootId: null,
        isReady: false,
      });
    }
    return this.surfaces.get(surfaceId)!;
  }

  private handleSurfaceUpdate(payload: {
    surfaceId: string;
    components: A2Component[];
  }) {
    const surface = this.ensureSurface(payload.surfaceId);
    for (const comp of payload.components) {
      // Normalize Gemini's "type"/"props" format to standard "component" format
      const normalized = this.normalizeComponent(comp);
      surface.componentMap.set(normalized.id, normalized);
    }
  }

  private normalizeComponent(comp: any): A2Component {
    if (comp.component) return comp as A2Component;
    // Handle Gemini's alternative format: { id, type, props }
    if (comp.type && comp.props) {
      return {
        id: comp.id,
        component: { [comp.type]: comp.props } as any,
      };
    }
    return comp as A2Component;
  }

  private handleDataModelUpdate(payload: {
    surfaceId: string;
    path?: string;
    contents: DataModelEntry[];
  }) {
    const surface = this.ensureSurface(payload.surfaceId);
    const data = this.entriesToObject(payload.contents);

    if (payload.path) {
      this.setPath(surface.dataModel, payload.path, data);
    } else {
      Object.assign(surface.dataModel, data);
    }
  }

  private handleBeginRendering(payload: {
    surfaceId: string;
    root: string;
  }) {
    const surface = this.ensureSurface(payload.surfaceId);
    surface.rootId = payload.root;
    surface.isReady = true;
  }

  private handleDeleteSurface(payload: { surfaceId: string }) {
    this.surfaces.delete(payload.surfaceId);
  }

  private entriesToObject(entries: DataModelEntry[]): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    for (const entry of entries) {
      if (entry.valueString !== undefined) {
        obj[entry.key] = entry.valueString;
      } else if (entry.valueNumber !== undefined) {
        obj[entry.key] = entry.valueNumber;
      } else if (entry.valueBoolean !== undefined) {
        obj[entry.key] = entry.valueBoolean;
      } else if (entry.valueMap !== undefined) {
        obj[entry.key] = this.entriesToObject(entry.valueMap);
      } else if (entry.valueArray !== undefined) {
        obj[entry.key] = entry.valueArray;
      }
    }
    return obj;
  }

  private setPath(target: Record<string, unknown>, path: string, value: unknown) {
    const parts = path.split('/').filter(Boolean);
    let current: Record<string, unknown> = target;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
        current[parts[i]] = {};
      }
      current = current[parts[i]] as Record<string, unknown>;
    }
    const last = parts[parts.length - 1];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      current[last] = { ...(current[last] as object || {}), ...value };
    } else {
      current[last] = value;
    }
  }
}
