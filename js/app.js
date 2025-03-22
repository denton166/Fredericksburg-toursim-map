// Initialize Cordova app
document.addEventListener('deviceready', onDeviceReady, false);

function onDeviceReady() {
    console.log('Cordova initialized on: ' + device.platform);

    // Hide the splash screen after a delay
    setTimeout(function () {
        navigator.splashscreen.hide();
    }, 2000);

    // Check if the app is online
    if (navigator.connection.type === Connection.NONE) {
        navigator.notification.alert(
            'No internet connection detected. Some features may be unavailable.',
            null,
            'Offline Mode',
            'OK'
        );
    }
}
