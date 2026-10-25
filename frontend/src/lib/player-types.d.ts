declare module "videojs-wavesurfer";
declare module "wavesurfer.js/dist/plugin/wavesurfer.timeline.js" { const Timeline: { create(options: { container: HTMLElement }): unknown }; export default Timeline; }
declare module "mediaelement";
declare module "pell" {
  export function init(options: { element: HTMLElement; onChange(html: string): void }): HTMLElement;
  export function exec(command: string, value?: string): boolean;
}
