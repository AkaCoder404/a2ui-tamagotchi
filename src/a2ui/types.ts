/**
 * A2UI Protocol Types — Extended for Tamagotchi Custom Components
 */

export interface BoundValue {
  literalString?: string;
  literalNumber?: number;
  literalBoolean?: boolean;
  path?: string;
}

export type BoundValueOrString = BoundValue | string;
export type BoundValueOrNumber = BoundValue | number;
export type BoundValueOrBoolean = BoundValue | boolean;

export interface A2Component {
  id: string;
  component: ComponentVariant;
}

export type ComponentVariant =
  | { Text: TextProps }
  | { Button: ButtonProps }
  | { Card: CardProps }
  | { Column: ColumnProps }
  | { Row: RowProps }
  | { TextField: TextFieldProps }
  | { CheckBox: CheckBoxProps }
  | { ChoicePicker: ChoicePickerProps }
  | { Icon: IconProps }
  | { Divider: DividerProps }
  | { List: ListProps }
  | { Image: ImageProps }
  // Tamagotchi custom components
  | { scene: SceneProps }
  | { background: BackgroundProps }
  | { 'pet-avatar': PetAvatarProps }
  | { 'stat-bars': StatBarsProps }
  | { 'thought-bubble': ThoughtBubbleProps }
  | { 'action-palette': ActionPaletteProps }
  | { 'inventory-slot': InventorySlotProps };

export interface TextProps {
  text: BoundValueOrString;
  usageHint?: 'h1' | 'h2' | 'h3' | 'body' | 'caption';
}

export interface ButtonProps {
  child?: string;
  label?: BoundValueOrString;
  variant?: 'primary' | 'secondary' | 'danger';
  action?: {
    name: string;
    context?: Record<string, BoundValue>;
  };
}

export interface CardProps {
  child?: string;
  children?: string[];
}

export interface ColumnProps {
  children: ChildrenSpec;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'spaceBetween' | 'spaceAround';
  gap?: number;
}

export interface RowProps {
  children: ChildrenSpec;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'spaceBetween' | 'spaceAround';
  gap?: number;
}

export interface ChildrenSpec {
  explicitList?: string[];
  template?: {
    dataBinding: string;
    componentId: string;
  };
}

export interface TextFieldProps {
  label?: BoundValueOrString;
  value?: BoundValueOrString;
  placeholder?: BoundValueOrString;
  variant?: 'shortText' | 'longText';
}

export interface CheckBoxProps {
  label?: BoundValueOrString;
  value?: BoundValueOrBoolean;
}

export interface ChoicePickerProps {
  label?: BoundValueOrString;
  variant?: 'mutuallyExclusive' | 'multiple';
  options: { label: string; value: string }[];
  value?: BoundValueOrString | BoundValueOrString[];
}

export interface IconProps {
  name: string;
  size?: number;
  color?: string;
}

export interface DividerProps {
  axis?: 'horizontal' | 'vertical';
}

export interface ListProps {
  children: ChildrenSpec;
}

export interface ImageProps {
  url: BoundValueOrString;
  alt?: BoundValueOrString;
  width?: BoundValueOrNumber;
  height?: BoundValueOrNumber;
}

// ==================== TAMAGOTCHI CUSTOM COMPONENTS ====================

export interface SceneProps {
  width?: BoundValueOrNumber;
  height?: BoundValueOrNumber;
  children: ChildrenSpec;
}

export interface BackgroundProps {
  variant: BoundValueOrString;
  moodTint?: BoundValueOrString;
}

export interface PetAvatarProps {
  x: BoundValueOrNumber;
  y: BoundValueOrNumber;
  size: BoundValueOrString;
  expression: BoundValueOrString;
  bounce?: BoundValueOrBoolean;
}

export interface StatBarsProps {
  hunger: BoundValueOrNumber;
  happiness: BoundValueOrNumber;
  energy: BoundValueOrNumber;
  affection: BoundValueOrNumber;
}

export interface ThoughtBubbleProps {
  text: BoundValueOrString;
  visible?: BoundValueOrBoolean;
}

export interface ActionPaletteProps {
  actions: BoundValueOrString[];
}

export interface InventorySlotProps {
  items: BoundValueOrString[];
}

// ==================== MESSAGES ====================

export type ServerMessage =
  | { surfaceUpdate: SurfaceUpdatePayload }
  | { dataModelUpdate: DataModelUpdatePayload }
  | { beginRendering: BeginRenderingPayload }
  | { deleteSurface: DeleteSurfacePayload };

export interface SurfaceUpdatePayload {
  surfaceId: string;
  components: A2Component[];
}

export interface DataModelUpdatePayload {
  surfaceId: string;
  path?: string;
  contents: DataModelEntry[];
}

export interface DataModelEntry {
  key: string;
  valueString?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueMap?: DataModelEntry[];
  valueArray?: DataModelValue[];
}

export type DataModelValue =
  | string
  | number
  | boolean
  | { [key: string]: DataModelValue }
  | DataModelValue[];

export interface BeginRenderingPayload {
  surfaceId: string;
  root: string;
  catalogId?: string;
}

export interface DeleteSurfacePayload {
  surfaceId: string;
}

export interface UserAction {
  name: string;
  surfaceId: string;
  sourceComponentId: string;
  timestamp: string;
  context: Record<string, unknown>;
}

export type ClientMessage = { userAction: UserAction } | { error: unknown };

export interface Surface {
  surfaceId: string;
  componentMap: Map<string, A2Component>;
  dataModel: Record<string, unknown>;
  rootId: string | null;
  isReady: boolean;
}

export interface RenderContext {
  surfaceId: string;
  componentMap: Map<string, A2Component>;
  dataModel: Record<string, unknown>;
  onAction: (action: UserAction) => void;
  resolve: (bv: BoundValue | string | number | boolean | undefined) => unknown;
}
