// Shared paint for the Find Your Hunt maps so Colorado and Utah use the same fills.
// A unit with a hunt is solid. A unit with no hunt is 90% cream on the dark map.
// The outline is cream at 45% opacity, weight 0.7. There is no street basemap.
(function(){
'use strict';
function fillStyle(o){
  const cream=o.line||'#E8E0D2';
  const has=!!o.hunt;
  const otc=!!o.otc;
  const fill=has?o.fill:(otc?o.otcColor:o.none);
  const solid=(has&&(o.harvest||o.odds>=.05))||otc;
  return {color:cream, opacity:.45, weight:.7, fillColor:fill, fillOpacity:solid?1:.9};
}
function detailStyle(on, fill, cream){
  cream=cream||'#E8E0D2';
  return on
    ? {color:cream, weight:2.5, fillColor:fill, fillOpacity:1}
    : {color:cream, opacity:.3, weight:.5, fillColor:cream, fillOpacity:.35};
}
// Extended archery and other overlays: a dashed cream line, no fill, so the unit under it stays one color.
function overlayStyle(cream){
  return {color:cream||'#E8E0D2', weight:2.5, opacity:1, fill:false, dashArray:'8 6'};
}
window.RWMap={fillStyle, detailStyle, overlayStyle};
})();
