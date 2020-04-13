import React, { useState, useEffect, Component } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  ScrollView,
  Text,
  View,
  Alert,
  Button,
  StatusBar,
  AppState,
} from 'react-native';
import MapView, {
  Polygon,
} from 'react-native-maps'
import GeoFencing from 'react-native-geo-fencing';
import firestore from '@react-native-firebase/firestore';
import BackgroundTimer from 'react-native-background-timer';
import BackgroundGeolocation from '@mauron85/react-native-background-geolocation';
import _ from 'lodash';

const polygon = [
  {
    latitude: 24.904858,
    longitude: 67.043736,
  },
  {
    latitude: 24.909013,
    longitude: 67.046212,
  },
  {
    latitude: 24.902332,
    longitude: 67.042806,
  },
  {
    latitude: 24.907743,
    longitude: 67.039501,
  },
]


class App extends Component {

  state = {
    data: null,
    coords: null,
    toggle: true,
    appState: AppState.currentState
  }

  componentDidMount() {
    this.backgroundJobs();
    this.database();
    BackgroundGeolocation.start();
    AppState.addEventListener("change", this._handleAppStateChange);
  }


  backgroundJobs = () => {
    BackgroundGeolocation.configure({
      stationaryRadius: 50,
      distanceFilter: 50,
      notificationsEnabled: false,
      notificationTitle: '',
      notificationText: '',
      debug: false,
      startOnBoot: false,
      stopOnTerminate: true,
      desiredAccuracy: BackgroundGeolocation.HIGH_ACCURACY,
      locationProvider: BackgroundGeolocation.ACTIVITY_PROVIDER,
      interval: 10000,
      fastestInterval: 5000,
      activitiesInterval: 10000,
      startForeground: true,
      saveBatteryOnBackground: false,
      stopOnStillActivity: false,
      // // customize post properties
      // postTemplate: {
      //   lat: '@latitude',
      //   lon: '@longitude',
      //   foo: 'bar' // you can also add your own properties
      // }
    });

    BackgroundGeolocation.on('location', (location) => {
      this.setState({ coords: location }, () => {
        console.log('BackgroundGeolocation location:', location);
      })
      // BackgroundGeolocation.startTask(taskKey => {
      //   // execute long running task
      //   // eg. ajax post location
      //   // IMPORTANT: task has to be ended by endTask
      //   BackgroundGeolocation.endTask(taskKey);
      // });
    });

    BackgroundGeolocation.on('stationary', (stationaryLocation) => {
      console.log('BackgroundGeolocation stationaryLocation:', stationaryLocation);
    });

    BackgroundGeolocation.on('error', (error) => {
      console.log('[ERROR] BackgroundGeolocation error:', error);
    });

    BackgroundGeolocation.on('start', () => {
      console.log('[INFO] BackgroundGeolocation service has been started');
    });

    BackgroundGeolocation.on('stop', () => {
      console.log('[INFO] BackgroundGeolocation service has been stopped');
    });

    BackgroundGeolocation.on('authorization', (status) => {
      console.log('[INFO] BackgroundGeolocation authorization status: ' + status);
      if (status !== BackgroundGeolocation.AUTHORIZED) {
        setTimeout(() =>
          Alert.alert('App requires location tracking permission', 'Would you like to open app settings?', [
            { text: 'Yes', onPress: () => BackgroundGeolocation.showAppSettings() },
            { text: 'No', onPress: () => console.log('No Pressed'), style: 'cancel' }
          ]), 1000);
      }
    });

    // BackgroundGeolocation.on('background', () => {
    //   hitApi();
    //   console.log('[INFO] App is in background');
    // });

    // BackgroundGeolocation.on('foreground', () => {
    //   setStatus("");
    //   clearTimeout(timer);
    //   console.log('[INFO] App is in foreground');
    // });

    BackgroundGeolocation.on('abort_requested', () => {
      console.log('[INFO] Server responded with 285 Updates Not Required');
    });

    BackgroundGeolocation.on('http_authorization', () => {
      console.log('[INFO] App needs to authorize the http requests');
    });

    BackgroundGeolocation.checkStatus(status => {
      console.log('[INFO] BackgroundGeolocation service is running', status.isRunning);
      console.log('[INFO] BackgroundGeolocation services enabled', status.locationServicesEnabled);
      console.log('[INFO] BackgroundGeolocation auth status: ' + status.authorization);

      // you don't need to check status before start (this is just the example)
      if (!status.isRunning) {
        // BackgroundGeolocation.start(); //triggers start on start event
      }
    });

    // you can also just start without checking for status
    // BackgroundGeolocation.start();
  }

  database = () => {
    this._subscriber = firestore()
      .collection('location')
      .doc('coords')
      .onSnapshot(doc => {
        if (doc.exists) {
          this.setState({ data: doc.data() })
        }
        else {
          this.setState({ data: null })
        }
      });
  }

  _handleAppStateChange = (nextAppState) => {
    const { coords } = this.state
    if (nextAppState === 'background') {
      console.log("App is in Background Mode.")
      this._timer = BackgroundTimer.setTimeout(() => {
        if (coords && !_.isEmpty(coords)) {
          console.log(coords, " coords ");
          const { latitude, longitude } = coords;
          const p = polygon.map(v => {
            return { lat: v.latitude, lng: v.longitude }
          });
          GeoFencing.containsLocation({ lat: latitude, lng: longitude }, p)
            .then(() => {
              firestore().collection('location').doc('coords').set({
                coords,
                message: "your location is within polygon",
              });
              console.log('point is within polygon')
            })
            .catch(() => {
              firestore().collection('location').doc('coords').set({
                coords,
                message: "your location is not within polygon",
              });
              console.log('point is NOT within polygon');
            })
        }
      }, 3000);
      // 300000
    }
    if (nextAppState === 'active') {
      console.log("App is in Active Foreground Mode.");
      BackgroundTimer.clearTimeout(this._timer);
    }
    if (nextAppState === 'inactive') {
      BackgroundTimer.clearTimeout(this._timer);
      console.log("App is in inactive Mode.")
    }
    this.setState({ appState: nextAppState })
  }

  componentWillUnmount() {
    this._subscriber()
    BackgroundGeolocation.removeAllListeners();
    AppState.removeEventListener("change", this._handleAppStateChange);
  }

  render() {
    const { coords, toggle, data } = this.state
    return (
      <>
        <StatusBar barStyle="dark-content" />
        <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
          <ScrollView
            contentContainerStyle={styles.scrollView}
            contentInsetAdjustmentBehavior="automatic"
          >
            {/* <View style={styles.mapWrapper}>
              <MapView
                style={styles.map}
              >
                <Polygon
                  coordinates={polygon}
                />
              </MapView>
            </View> */}
            <Text style={{ fontSize: 15, marginVertical: 20, textAlign: 'center', paddingHorizontal: 10, }}>
              {JSON.stringify(coords)}
            </Text>

            <View style={styles.btnWrapper}>
              <Button
                color={"teal"}
                title={toggle ? "Stop" : "Start"}
                onPress={() => {
                  this.setState({ toggle: !toggle })
                  if (toggle) {
                    BackgroundGeolocation.stop()
                  }
                  else {
                    BackgroundGeolocation.start()
                  }
                }}
              />
              <Button
                disabled={data === null}
                title={"Clear Firebase"}
                onPress={() => {
                  firestore().collection('location').doc('coords').delete();
                }}
              />
            </View>
            {data && (
              <>
                <Text style={{ fontSize: 15, marginTop: 30, textAlign: 'center', paddingHorizontal: 10, }}>
                  Firebase
                </Text>
                <Text style={{ fontSize: 15, marginVertical: 10, textAlign: 'center', paddingHorizontal: 10, }}>
                  {data.message}
                </Text>
                <Text style={{ fontSize: 15, marginBottom: 30, marginTop: 10, textAlign: 'center', paddingHorizontal: 10, }}>
                  {JSON.stringify(data.coords)}
                </Text>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </>
    )
  }
}

const styles = StyleSheet.create({
  scrollView: {
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: "#fff",
  },
  mapWrapper: {
    height: 400,
    width: '100%',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  btnWrapper: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-evenly'
  }
});

export default App;
