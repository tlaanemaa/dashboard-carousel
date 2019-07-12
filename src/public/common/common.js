// Version checker to reload UI on version change
class VersionChecker {
  constructor(intervalSeconds = 300) {
    this.intervalSeconds = intervalSeconds;

    this.version = null;
    this.interval = setInterval(this.checkVersion.bind(this), this.intervalSeconds * 1000);
    this.checkVersion();
  }

  async checkVersion() {
    try {
      const res = await fetch('dashboard-status');
      const body = await res.json();
      this.checkAndReload(body.versionId);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }

  checkAndReload(version) {
    if (this.version != null && this.version !== version) {
      window.location.reload(true);
    } else {
      this.version = version;
    }
  }
}

const versionChecker = new VersionChecker();

// Common method to post json
window.postJson = async (url, data) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      actions: [data],
    }),
  });

  const responseJson = await response.json();

  // Check server version if we have it and return
  if (responseJson.versionId != null) {
    versionChecker.checkAndReload(responseJson.versionId);
  }
  return responseJson;
};
