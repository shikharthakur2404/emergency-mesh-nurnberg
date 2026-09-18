import 'react-native-get-random-values'; // CSPRNG polyfill — must be first
import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
