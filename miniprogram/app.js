const CLOUD_ENV_ID = 'cloud1-d0gos8gobac3c3623';
App({
  globalData:{cloudReady:false},
  onLaunch(){
    // Existing environment retained. New collections are isolated; formal access defaults CLOSED.
    if(wx.cloud){try{wx.cloud.init({env:CLOUD_ENV_ID,traceUser:false});this.globalData.cloudReady=true;}catch(_){}}
    require('./utils/banli-api').prune();
  }
});
