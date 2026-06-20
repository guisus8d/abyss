const PRESETS = [
  require('../../assets/profile-presets/preset_avatar_01.png'),
  require('../../assets/profile-presets/preset_avatar_02.png'),
  require('../../assets/profile-presets/preset_avatar_03.png'),
  require('../../assets/profile-presets/preset_avatar_04.png'),
  require('../../assets/profile-presets/preset_avatar_05.png'),
  require('../../assets/profile-presets/preset_avatar_06.png'),
  require('../../assets/profile-presets/preset_avatar_07.png'),
  require('../../assets/profile-presets/preset_avatar_08.png'),
];

export function presetFromId(id = '') {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return PRESETS[Math.abs(h) % PRESETS.length];
}
