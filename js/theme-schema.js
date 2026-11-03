// Shared schema used by early restoration, editor and import validation.
(() => {
 const groups = {"Desktop": {"desktopBackground": "bg", "desktopLabels": "accent"}, "Windows": {"windowBackground": "bg", "titleActive": "accent", "titleInactive": "dim", "titleText": "bg", "titleInactiveText": "accent", "border": "accent", "shadow": "dim"}, "Taskbar and menus": {"taskbar": "bg", "startMenu": "bg", "menu": "bg", "dropdown": "bg"}, "Text and links": {"textPrimary": "accent", "textSecondary": "accent", "textMuted": "accent", "textDisabled": "dim", "link": "accent", "linkHover": "accent", "linkVisited": "accent"}, "Controls": {"buttonBackground": "bg", "buttonText": "accent", "hoverBackground": "dim", "hoverText": "accent", "inputBackground": "bg", "inputText": "accent", "selectionBackground": "accent", "selectionText": "bg", "focus": "accent", "accent": "accent"}, "Surfaces": {"panel": "dim", "divider": "dim", "scrollbarThumb": "accent", "scrollbarTrack": "bg", "tooltipBackground": "bg", "tooltipText": "accent"}, "Applications": {"radioBackground": "#001204", "radioAccent": "accent", "explorerBackground": "bg", "browserBackground": "bg", "pageBackground": "#08140c", "pageText": "#b5edc0", "radioPageBackground": "#101a20", "radioPageText": "#c5e9ee", "errorPageBackground": "#211515", "errorPageText": "#ffd3c9", "arcadeBackground": "#0b1010", "arcadeText": "#a6ff85", "arcadePanel": "#14151b", "arcadeAccent": "#caa1ff", "arcadeBorder": "#9270be", "arcadeButton": "#142219"}};
 // Version 1 keys stay fixed so incomplete legacy imports are still rejected.
 const legacyKeys = Object.values(groups).flatMap(group => Object.keys(group));
 const additions = {
  "Desktop": {desktopSelectionBackground:'dim', desktopSelectionText:'accent', desktopSelectionBorder:'accent'},
  "Taskbar buttons": {taskbarButtonBackground:'bg', taskbarButtonText:'accent', taskbarButtonBorder:'accent', taskbarButtonActiveBackground:'accent', taskbarButtonActiveText:'bg', taskbarButtonHoverBackground:'dim', taskbarButtonHoverText:'accent', taskbarButtonFocus:'accent'},
  "System tray": {trayBackground:'bg', trayText:'accent', trayBorder:'dim', clockText:'accent', connectionText:'accent', radioStatusText:'accent'}
 };
 const fallbacks = {
  desktopSelectionBackground:'hoverBackground', desktopSelectionText:'hoverText', desktopSelectionBorder:'border',
  taskbarButtonBackground:'buttonBackground', taskbarButtonText:'buttonText', taskbarButtonBorder:'border',
  taskbarButtonActiveBackground:'selectionBackground', taskbarButtonActiveText:'selectionText',
  taskbarButtonHoverBackground:'hoverBackground', taskbarButtonHoverText:'hoverText', taskbarButtonFocus:'focus',
  trayBackground:'taskbar', trayText:'textPrimary', trayBorder:'panel', clockText:'textPrimary', connectionText:'textPrimary', radioStatusText:'buttonText'
 };
 for (const [group, colors] of Object.entries(additions)) groups[group] = {...groups[group], ...colors};
 const bases = {"toxic": ["#65ff7d", "#14391d", "#030704"], "amber": ["#ffd16a", "#493415", "#090601"], "ice": ["#8cdfff", "#173b49", "#030709"], "blood": ["#ff9696", "#481b22", "#090304"], "violet": ["#d3a0ff", "#352044", "#070309"]};
 const keys = Object.values(groups).flatMap(group => Object.keys(group));
 function palette(id = 'toxic') {
  const [accent,dim,bg] = bases[id] || bases.toxic;
  return Object.fromEntries(Object.values(groups).flatMap(group => Object.entries(group).map(([key,value]) => [key, ({accent,dim,bg})[value] || value])));
 }
 function validate(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['version','name','colors'].includes(key)) || ![1,2].includes(value.version) || typeof value.name !== 'string' || value.name.length > 60) throw Error('Expected a version 1 or 2 theme with a name of at most 60 characters.');
  const colors = value.colors;
  const required = value.version === 1 ? legacyKeys : keys;
  if (!colors || typeof colors !== 'object' || Array.isArray(colors) || Object.keys(colors).length !== required.length || required.some(key => !Object.hasOwn(colors,key) || typeof colors[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(colors[key]))) throw Error('Theme must contain exactly the supported colors as #RRGGBB values.');
  const migrated = {...colors};
  if (value.version === 1) for (const [key, source] of Object.entries(fallbacks)) migrated[key] = colors[source];
  return {version:2,name:value.name.trim(),colors:Object.fromEntries(keys.map(key=>[key,migrated[key].toLowerCase()]))};
 }
 window.ZombThemeSchema = Object.freeze({version:2, groups, keys, palette, validate});
})();
