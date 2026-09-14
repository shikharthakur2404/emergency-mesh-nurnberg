/**
 * Emergency Mesh Nürnberg — Android Runtime Permissions Handler
 * Requests necessary hardware access for local wireless mesh networking.
 */

import { PermissionsAndroid, Platform } from 'react-native';

export async function requestMeshPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const permissionsToRequest = [
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ];

    // Android 12+ (API 31+) Bluetooth permissions
    if (Platform.Version >= 31) {
      if (PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN) {
        permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN);
      }
      if (PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT) {
        permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
      }
      if (PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE) {
        permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE);
      }
    }

    // Android 13+ (API 33+) Nearby Wi-Fi devices permission
    if (Platform.Version >= 33 && (PermissionsAndroid.PERMISSIONS as any).NEARBY_WIFI_DEVICES) {
      permissionsToRequest.push((PermissionsAndroid.PERMISSIONS as any).NEARBY_WIFI_DEVICES);
    }

    const results = await PermissionsAndroid.requestMultiple(permissionsToRequest);
    console.info('[requestMeshPermissions] Permissions evaluation result:', results);
    return true;
  } catch (err) {
    console.warn('[requestMeshPermissions] Permission request exception:', err);
    return false;
  }
}
