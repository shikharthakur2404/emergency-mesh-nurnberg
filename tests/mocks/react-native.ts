export const Platform = {
  OS: 'android',
  select: (obj: any) => (obj && obj.android !== undefined ? obj.android : obj ? obj.default : undefined),
};

export const AppState = {
  currentState: 'active',
  addEventListener: (_event: string, _callback: (state: string) => void) => ({
    remove: () => {},
  }),
};

export const PermissionsAndroid = {
  PERMISSIONS: {
    ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
    ACCESS_COARSE_LOCATION: 'android.permission.ACCESS_COARSE_LOCATION',
    POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS',
    NEARBY_WIFI_DEVICES: 'android.permission.NEARBY_WIFI_DEVICES',
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
    NEVER_ASK_AGAIN: 'never_ask_again',
  },
  check: async (_permission: string) => true,
  requestMultiple: async (_permissions: string[]) => ({
    'android.permission.ACCESS_FINE_LOCATION': 'granted',
    'android.permission.ACCESS_COARSE_LOCATION': 'granted',
    'android.permission.POST_NOTIFICATIONS': 'granted',
  }),
};

export const PixelRatio = {
  getFontScale: () => 1.0,
  get: () => 2.0,
};

export const Dimensions = {
  get: (dim: 'window' | 'screen') => ({
    width: 390,
    height: 844,
    scale: 2.0,
    fontScale: 1.0,
  }),
};

export const StyleSheet = {
  create: (styles: any) => styles,
};

export const NativeModules = {
  UdpMeshModule: {
    startRadio: async () => true,
    broadcastPacket: async () => true,
    stopRadio: async () => true,
    getNetworkInfo: async () => ({ broadcastAddresses: ['255.255.255.255'] }),
  },
};

export class NativeEventEmitter {
  addListener(_event: string, _callback: Function) {
    return { remove: () => {} };
  }
}

export const Alert = {
  alert: () => {},
};

export const View = 'View';
export const Text = 'Text';
export const TextInput = 'TextInput';
export const TouchableOpacity = 'TouchableOpacity';
export const ScrollView = 'ScrollView';
export const StatusBar = 'StatusBar';
