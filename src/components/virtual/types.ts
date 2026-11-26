/** Shapes the virtual-tour components receive, already localized for the current page. */

export interface ViewerCredit {
  author: string;
  license: string;
  licenseUrl?: string;
  source: string;
}

export interface ViewerHotspot {
  id: string;
  kind: "info" | "scene";
  pitch: number;
  yaw: number;
  label: string;
  /** Info hotspots: the short story shown in the panel. */
  text?: string;
  /** Scene hotspots: the scene to walk to. */
  target?: string;
}

export interface ViewerScene {
  id: string;
  title: string;
  caption: string;
  image: string;
  thumb: string;
  yaw: number;
  pitch: number;
  hfov: number;
  credit: ViewerCredit;
  hotspots: ViewerHotspot[];
}

export interface PhotoSlideView {
  image: string;
  title: string;
  caption: string;
  credit: ViewerCredit;
}
