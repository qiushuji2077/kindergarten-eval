const CLOUD_ENV_ID = 'cloud1-d0gos8gobac3c3623';

App({
  globalData: {
    cloudReady: false,
  },
  onLaunch() {
    const session = wx.getStorageSync('session');
    this.globalData.session = session || null;
    if (!wx.cloud) return;
    try {
      wx.cloud.init({
        env: CLOUD_ENV_ID,
        traceUser: true,
      });
      this.globalData.cloudReady = true;
    } catch (err) {
      this.globalData.cloudReady = false;
    }
  },
});
