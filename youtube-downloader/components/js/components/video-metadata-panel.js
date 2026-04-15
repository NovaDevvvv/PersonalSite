export class VideoMetadataPanel {
  constructor(rootElement) {
    this.rootElement = rootElement;
    this.titleElement = document.getElementById("videoTitle");
    this.lengthElement = document.getElementById("videoLength");
    this.uploaderElement = document.getElementById("videoUploader");
  }

  show(payload) {
    this.titleElement.textContent = payload.title;
    this.lengthElement.textContent = payload.length;
    this.uploaderElement.textContent = payload.uploader;
    this.rootElement.hidden = false;
  }
}