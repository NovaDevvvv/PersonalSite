export class DownloadOptionsPanel {
  constructor(rootElement) {
    this.rootElement = rootElement;
    this.formElement = rootElement;
    this.formatElement = document.getElementById("formatSelect");
    this.audioCodecElement = document.getElementById("audioCodecSelect");
    this.videoCodecElement = document.getElementById("videoCodecSelect");
    this.qualityElement = document.getElementById("qualitySelect");
  }

  static audioOnlyFormats = new Set(["mp3", "m4a", "wav", "flac"]);

  show() {
    this.rootElement.hidden = false;
    this.syncCodecVisibility();
  }

  hide() {
    this.rootElement.hidden = true;
  }

  getValues() {
    return {
      format: this.formatElement.value,
      audioCodec: this.audioCodecElement.value,
      videoCodec: this.videoCodecElement.value,
      quality: this.qualityElement.value,
    };
  }

  onSubmit(handler) {
    this.formElement.addEventListener("submit", (event) => {
      event.preventDefault();
      handler(this.getValues());
    });

    this.formatElement.addEventListener("change", () => {
      this.syncCodecVisibility();
    });
  }

  syncCodecVisibility() {
    const isAudioOnly = DownloadOptionsPanel.audioOnlyFormats.has(this.formatElement.value);
    this.videoCodecElement.closest("label").hidden = isAudioOnly;
    this.qualityElement.closest("label").hidden = isAudioOnly;
  }
}