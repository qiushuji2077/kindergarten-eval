function callPrivacyApi(name) {return new Promise((resolve,reject)=>wx[name]({success:resolve,fail:reject}));}
function bindPrivacyAuthorization(page) {
  if(!wx.onNeedPrivacyAuthorization||!page)return;
  const handler=resolve=>{page._resolvePrivacyAuthorization=resolve;page.setData({showPrivacy:true,privacyRequired:true});};
  page._privacyAuthorizationHandler=handler;wx.onNeedPrivacyAuthorization(handler);
}
function unbindPrivacyAuthorization(page) {
  if(!page)return;
  if(page._resolvePrivacyAuthorization){page._resolvePrivacyAuthorization({event:'disagree'});page._resolvePrivacyAuthorization=null;}
  if(wx.offNeedPrivacyAuthorization&&page._privacyAuthorizationHandler)wx.offNeedPrivacyAuthorization(page._privacyAuthorizationHandler);
  page._privacyAuthorizationHandler=null;
}
function finishPrivacyAuthorization(page,agreed) {
  if(!page)return;const resolve=page._resolvePrivacyAuthorization;page._resolvePrivacyAuthorization=null;
  if(resolve)resolve(agreed?{event:'agree',buttonId:'agree-privacy-btn'}:{event:'disagree'});
  page.setData({showPrivacy:false,privacyRequired:false});
}
async function ensurePrivacyAuthorized(page) {
  if(!wx.getPrivacySetting||!wx.requirePrivacyAuthorize)return true;
  const setting=await callPrivacyApi('getPrivacySetting');if(page&&setting.privacyContractName)page.setData({privacyContractName:setting.privacyContractName});
  if(!setting.needAuthorization)return true;
  try{await callPrivacyApi('requirePrivacyAuthorize');return true;}
  catch(_){const error=new Error('需要同意隐私保护指引后才能拍照或录音');error.code='PRIVACY_DENIED';throw error;}
}
function openPrivacyContract(){
  if(!wx.openPrivacyContract){wx.navigateTo({url:'/pages/legal/privacy'});return;}
  wx.openPrivacyContract({fail:()=>wx.navigateTo({url:'/pages/legal/privacy'})});
}
module.exports={bindPrivacyAuthorization,ensurePrivacyAuthorized,finishPrivacyAuthorization,openPrivacyContract,unbindPrivacyAuthorization};
