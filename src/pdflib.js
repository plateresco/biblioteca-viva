// Carga perezosa de pdf.js (se descarga solo cuando abres o importas un PDF).
let promesa = null;
export function cargarPdfJs() {
  if (!promesa) promesa = (async () => {
    const lib = await import('pdfjs-dist/build/pdf.min.mjs');
    const Trabajador = (await import('pdfjs-dist/build/pdf.worker.min.mjs?worker')).default;
    lib.GlobalWorkerOptions.workerPort = new Trabajador();
    await import('pdfjs-dist/web/pdf_viewer.css');
    return lib;
  })();
  return promesa;
}
