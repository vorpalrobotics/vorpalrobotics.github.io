

// CONVERTED CODE

class VorpalCombatHexapod {
    //Converted from https://gistcdn.githack.com/ZenithRogue/c72e7e3afb7a30c1b62844fd80b12cb4/raw/039dc31e35d0b59fc450ba1d3dacecca1f6a2f14/Vorpal-Hexapod-Scratch.js to Scratch 3.0 using Ext2to3!

    // Copied from scratch 2 functions that conversion missed

    var device = null;
    var rawData = null;
    var Recording = 0;	// 1 if we're recording, 0 otherwise
    var trace = 0;    // make this nonzero to trace data packet reception

    //
    // finite state machine for input processing
    //
    const ST_START     = 0;    // waiting for start of a new packet
    const ST_COM       = 1;    // stripping comments until next newline
    const ST_WAIT_1    = 2;    // waiting for a "1" version number
    const ST_WAIT_LEN  = 3;    // waiting for the payload length byte
    const ST_PAYLOAD   = 4;    // reading the payload
    const ST_WAIT_CS   = 5;    // waiting for the checksum

    var InputState = ST_START;
    var packetLength = 0;
    var packetReceived = 0;
    var packetData = null;
    var curComment = null;    // the current partial comment
    // the current value of sensors
    // these are not changed until a complete packet is
    // received
    var SensorA3 = 0;
    var SensorA6 = 0;
    var SensorA7 = 0;
    var SensorDistance = 0;

    // cmucam5 support  CURRENTLY EXPERIMENTAL
    var SensorPixySignature = -1;
    var SensorPixyX = -1;
    var SensorPixyY = -1;
    var SensorPixyWidth = -1;
    var SensorPixyHeight = -1;

    ext.resetAll = function(){};

    function appendBuffer( buffer1, buffer2 ) {
        if (buffer1 === null) {
            return new Uint8Array(buffer2);
        }
        var tmp = new Uint8Array( buffer1.byteLength + buffer2.byteLength );
        tmp.set( new Uint8Array( buffer1 ), 0 );
        tmp.set( new Uint8Array( buffer2 ), buffer1.byteLength );
        return tmp.buffer;
    }

    // Extension API interactions
    var potentialDevices = [];
    ext._deviceConnected = function(dev) {
        console.log("Device Detected:" + dev.id);
        potentialDevices.push(dev);

        if (!device) {
            tryNextDevice();
        }
    };

    var poller = null;
    var watchdog = null;
    var curCmd = null;
    var curCmdRec = null;


    function setSimpleCommand(cmdbuf) {
    var cb = new Uint8Array(cmdbuf);
    // add four bytes for V1 header, length, and checksum
    // and add one more byte for "S" sensor request at end
    // if we're not recording

    var c = new Uint8Array(4+(1-Recording)+cb.length);

    c[0] = "V".charCodeAt();
    c[1] = "1".charCodeAt();
    c[2] = cb.length+(1-Recording);        // going to add a sensor request "S" at the end if not recording
    var checksum = c[2]; //WAS cb.length+1;
    for (var i = 0; i < cb.length; i++) {
        c[3+i] = cb[i];
        checksum += cb[i];
    }
    if (Recording === 0) {
        c[cb.length+3] = "S".charCodeAt();    // sensor read request
        checksum += c[cb.length+3];
    }

    checksum = checksum%256;

    c[cb.length+4] = checksum;
    curCmd = c;
    console.log("setsimple:" + curCmd.length);
    }


    function bin2string(array){
        if (array === null) {
            return String("null");
        }
    var result = "";
    for(var i = 0; i < array.length; ++i){
    result += (String.fromCharCode(array[i]));
    }
    return result;
     }


    var deviceOpenedNotify = null;

    function deviceOpenedCallback(dev) {
        if (!dev) {
            device = null;
      console.log("Dev was null in deviceOpenedCallback");
            tryNextDevice();
            return;
        }
        console.log("Open Successful: " + device.id);

    potentialDevices = [];   // TEST TEST TEST

        device.set_receive_handler(function(data) {
            if (trace) console.log("RCV:BYTELEN=" + data.byteLength);
            rawData = appendBuffer(rawData, data);
            processData();

        });
        if (deviceOpenedNotify !== null) {
    /////////////////////////////////////////////////
       console.log("Setting deviceOpenedNotify watchdog");
       window.setTimeout(function() {
           deviceOpenedNotify();
           deviceOpenedNotify = null;
     console.log("WAITED FOR CLEAR");
       }, 2500);

    /////////////////////////////////////////////////
            //TEST TEST
      //deviceOpenedNotify();
            //deviceOpenedNotify = null;
        }

    //
    // send commands once every 100 ms, same as gamepad
    //

    if (poller === null) {
        poller = setInterval(function() {
         if (device !== null) {
      if (curCmdRec !== null) {
        // we have a record command, send that first
        device.send(curCmdRec.buffer);
        // these only get sent once
        console.log("POLLER SENT RECORD COMMAND:" + bin2string(curCmdRec));
        curCmdRec = null;
      }
      if (curCmd !== null) {
          device.send(curCmd.buffer);
          console.log("POLLER SENT CMD len=" + curCmd.length + " " + bin2string(curCmd));
          // if it's a beep command, we will not retransmit
          if (curCmd.length > 3 && curCmd[3] == "B".charCodeAt()) {
        curCmd = null;
        console.log("POLLER Cleared BEEP");
          }
      }
          }
        }, 100);  // for debugging slow it down from 100 ms to 2000 ms
    }

    if (0) {  // for now we're just going to take the lowest com port and hope for the best
        watchdog = setTimeout(function() {
            // This device didn't get good data in time, so give up on it. Clean up and then move on.
            // If we get good data then we'll terminate this watchdog.
            clearInterval(poller);
            console.log("watchdog!");
            poller = null;
            //device.set_receive_handler(null);
            device.close();
            device = null;
            tryNextDevice();
        }, 5000);
    }
    }

    function tryNextDevice() {
        // If potentialDevices is empty, device will be undefined.
        // That will get us back here next time a device is connected.
        device = potentialDevices.shift();
        if (!device) return;
    console.log("Attempting device open: " + device.id);

        device.open({ stopBits: 1, bitRate: 9600, ctsFlowControl: 0 }, deviceOpenedCallback);

    }

    ext.startserial = function() {
        console.log("STARTSERIAL");
    };

    /*********************************
    function bin2string(array){
        if (array === null) {
            return String("null");
        }
    var result = "";
    for(var i = 0; i < array.length; ++i){
    result += (String.fromCharCode(array[i]));
    }
    return result;
     };
     **********************************/


    function processData() {

        while (rawData !== null && rawData.length > 0) {
            var b = rawData[0];
            rawData = rawData.subarray(1,rawData.length);
            if (rawData.length === 0) {
                rawData = null;
            }

            switch (InputState) {
            case ST_START:
                if (b == "V".charCodeAt()) {
                    if (trace) console.log("RCV:V");
                    InputState = ST_WAIT_1;
                } else if (b == "#".charCodeAt()) {
                    if (trace) console.log("RCV:#");
                    InputState = ST_COM;
    } else if (b == 10 || b == 13) { // carraige return or newline
      // do nothing, ignore it
                } else {
                    console.log("RCV:ERROR:ST_START:"+b+"["+String.fromCharCode(b)+"]");
                }
                break;
            case ST_WAIT_1:
                if (b == "1".charCodeAt()) {
                    InputState = ST_WAIT_LEN;
                    if (trace) console.log("RCV:1");
                } else {
                    console.log("RCV:ERROR:ST_WAIT_1:"+b+"["+String.fromCharCode(b)+"]");
                    // error so return to start state
                    InputState = ST_START;
                }
                break;
            case ST_COM:
                // Comment coming from the gamepad,
                // so flush everything up to a newline
                if (b == 10 || b == 13) {     // newline ascii code is 10, CR is 13
                    InputState = ST_START;
                    if (curComment !== null) {
                        console.log("#" + bin2string(curComment));
                        curComment = null;
                    }
                } else {
                    // append the character to the current comment
                    // and we'll console.log it when its all received

                    if (curComment === null) {
                       curComment = new Uint8Array(1);
                       curComment[0] = b;
                    } else {
                       var tmp = new Uint8Array(curComment.length+1);
                       tmp.set(curComment, 0);
                       tmp[curComment.length] = b;
                       curComment = tmp;
                    }
                }
                break;

            case ST_WAIT_LEN:

                packetLength = b;
                packetReceived = 0;
                packetData = new Uint8Array(b+0);
                InputState = ST_PAYLOAD;
                if (trace) console.log("RCV:Len="+b);
                break;

            case ST_PAYLOAD:
                packetData[packetReceived++] = b;
                if (trace) console.log("RCV:Payload byte" + packetReceived + " of " + packetLength + " val=" + b);
                if (packetReceived == packetLength) {
                    // we got it all!
                    InputState = ST_WAIT_CS;
                    if (trace) console.log("RCV:incoming packet is complete");
                }
                break;

            case ST_WAIT_CS:
                // checksum must match packet received
                var checksum = packetLength; // sum includes length and packet bytes
                for (var i = 0; i < packetLength; i++) {
                    checksum += packetData[i];
                }
                checksum %= 256;    // mod 256 checksum

                if (checksum != b) {
                    console.log("RCV:CHECKSUM FAIL GOT:" + b + " EXPECTED:" + checksum);
                    InputState = ST_START; // back to the drawing board
                } else {
                    // we got a complete sensor data packet and it
                    // passes checksum! Cool beans!
                    // Now set the sensor values from the packet data
                    if (trace) console.log("RCV:Checksum is good");
                    if (packetLength == 8) {
                        // prototype hard codes 8 bytes
                        SensorA3 = packetData[0]*256+packetData[1];
                        SensorA6 = packetData[2]*256+packetData[3];
                        SensorA7 = packetData[4]*256+packetData[5];
                        SensorDistance = packetData[6]*256+packetData[7];

                        console.log("RCV:SENSORVALS:"+SensorA3+":"+SensorA6+":"+SensorA7+":"+SensorDistance);

                        if (packetLength >= 18) {
                            // next 10 bytes are cmucam5 pixy largest object detected
                            SensorPixySignature = packetData[8]*256+packetData[9];
                            SensorPixyX = packetData[10]*256+packetData[11];
                            SensorPixyY = packetData[12]*256+packetData[13];
                            SensorPixyWidth = packetData[14]*256+packetData[15];
                            SensorPixyHeight = packetData[16]*256+packetData[17];
                        } else {
                            SensorPixySignature = -1;
                            SensorPixyX = -1;
                            SensorPixyY = -1;
                            SensorPixyWidth = -1;
                            SensorPixyHeight = -1;
                        }
                    } else {
                        console.log("RCV:ERROR:Expected 8 byte payload, got "+packetLength);
                    }
                    InputState = ST_START;    // ready for next packet
                }
                break;

            default:
                console.log("RCV:ERROR:Unknown input state: "+InputState);
                InputState = ST_START;
                break;
            }
        }

        //console.log("RCV: Ran out of bytes to process");

    /*******************
        if (watchdog && (bytes[0] == "V".charCodeAt())) {
            // Seems to be a valid Gamepad.
            clearTimeout(watchdog);
            watchdog = null;
        console.log("V Received!");
        } else {
        console.log("Hmmm. Not V but rather " + bytes[0]);
    }
    **********************/
    }


    ext._deviceRemoved = function(dev) {
    console.log("Device removed");
        if(device != dev) return;
        if(poller) poller = clearInterval(poller);
        device = null;
    };

    ext._shutdown = function() {
        if(device) device.close();
        if(poller) poller = clearInterval(poller);
        device = null;
        console.log("shutdown");
    };

    ext._stop = function() {
        console.log("stop command received");
        curCmd = null;
        curCmdRec = null;
    };

    ext._getStatus = function() {
        if(!device) return {status: 1, msg: "Vorpal Gamepad disconnected"};
        return {status: 2, msg: "Vorpal Gamepad connected"};
        //add this back some day:
        //if(watchdog) return {status: 1, msg: "Vorpal Searching for Gamepad"};
    };

    getInfo() {
        return {
            "id": "VorpalCombatHexapod",
            "name": "VorpalCombatHexapod",
            "blocks": [{
                "opcode": "waitforconnection",
                "blockType": "command",
                "text": "Reset Connection",
                "arguments": {}
            }, {
                "opcode": "standstill",
                "blockType": "command",
                "text": "Stand Still: [style] seconds: [wtime]",
                "arguments": {
                    "style": {
                        "type": "string",
                        "menu": "standstyle",
                        "defaultValue": "normal"
                    },
                    "wtime": {
                        "type": "number",
                        "defaultValue": 1
                    }
                }
            }, {
                "opcode": "walk",
                "blockType": "command",
                "text": "Walk [ingait] [indir] seconds: [wtime]",
                "arguments": {
                    "ingait": {
                        "type": "string",
                        "menu": "gait",
                        "defaultValue": "normal"
                    },
                    "indir": {
                        "type": "string",
                        "menu": "direction",
                        "defaultValue": "forward"
                    },
                    "wtime": {
                        "type": "number",
                        "defaultValue": 1
                    }
                }
            }, {
                "opcode": "dance",
                "blockType": "command",
                "text": "Dance [dancemove] seconds: [wtime]",
                "arguments": {
                    "dancemove": {
                        "type": "string",
                        "menu": "dancemove",
                        "defaultValue": "twist"
                    },
                    "wtime": {
                        "type": "number",
                        "defaultValue": 1
                    }
                }
            }, {
                "opcode": "fightarms",
                "blockType": "command",
                "text": "Fight with arms [fightstyle] [fightmove] seconds: [wtime]",
                "arguments": {
                    "fightstyle": {
                        "type": "string",
                        "menu": "armfightstyle",
                        "defaultValue": "single arms"
                    },
                    "fightmove": {
                        "type": "string",
                        "menu": "armfightmove",
                        "defaultValue": "defend"
                    },
                    "wtime": {
                        "type": "number",
                        "defaultValue": 0.2
                    }
                }
            }, {
                "opcode": "fightadjust",
                "blockType": "command",
                "text": "Fight adjust [adjuststyle] seconds: [wtime]",
                "arguments": {
                    "adjuststyle": {
                        "type": "string",
                        "menu": "fightadjust",
                        "defaultValue": "square up"
                    },
                    "wtime": {
                        "type": "number",
                        "defaultValue": 0.2
                    }
                }
            }, {
                "opcode": "setleg",
                "blockType": "command",
                "text": "Set Legs: [legs] hips: [hippos] knees: [kneepos] options: [opts] seconds: [wtime]",
                "arguments": {
                    "legs": {
                        "type": "string",
                        "menu": "legs",
                        "defaultValue": "all"
                    },
                    "hippos": {
                        "type": "number",
                        "defaultValue": "90"
                    },
                    "kneepos": {
                        "type": "number",
                        "defaultValue": "90"
                    },
                    "opts": {
                        "type": "string",
                        "menu": "legopts",
                        "defaultValue": "mirror hips"
                    },
                    "wtime": {
                        "type": "number",
                        "defaultValue": 0.2
                    }
                }
            }, {
                "opcode": "sethips",
                "blockType": "command",
                "text": "Set Hips: [legs] [hippos] options: [opts] seconds: [wtime]",
                "arguments": {
                    "legs": {
                        "type": "string",
                        "menu": "legs",
                        "defaultValue": "all"
                    },
                    "hippos": {
                        "type": "number",
                        "defaultValue": "90"
                    },
                    "opts": {
                        "type": "string",
                        "menu": "legopts",
                        "defaultValue": "mirror hips"
                    },
                    "wtime": {
                        "type": "number",
                        "defaultValue": 0.2
                    }
                }
            }, {
                "opcode": "setknees",
                "blockType": "command",
                "text": "Set Knees: [legs] [kneepos] seconds: [wtime]",
                "arguments": {
                    "legs": {
                        "type": "string",
                        "menu": "legs",
                        "defaultValue": "all"
                    },
                    "kneepos": {
                        "type": "number",
                        "defaultValue": "90"
                    },
                    "wtime": {
                        "type": "number",
                        "defaultValue": 0.2
                    }
                }
            }, {
                "opcode": "setservo",
                "blockType": "command",
                "text": "Set Servo: port: [port] [postype] [pos] seconds: [wtime]",
                "arguments": {
                    "port": {
                        "type": "number",
                        "defaultValue": "12"
                    },
                    "postype": {
                        "type": "string",
                        "menu": "postype",
                        "defaultValue": "="
                    },
                    "pos": {
                        "type": "number",
                        "defaultValue": "90"
                    },
                    "wtime": {
                        "type": "number",
                        "defaultValue": 0
                    }
                }
            }, {
                "opcode": "gait",
                "blockType": "command",
                "text": "Gait: [style] [dir] hipsfwd: [hipfwd] hipsbw: [hipback] kneesup: [kneeup] kneesdown: [kneedown] lean: [lean] cycletime: [sec] seconds: [wtime]",
                "arguments": {
                    "style": {
                        "type": "string",
                        "menu": "gaitstyle",
                        "defaultValue": "tripod"
                    },
                    "dir": {
                        "type": "string",
                        "menu": "gaitdir",
                        "defaultValue": "forward"
                    },
                    "hipfwd": {
                        "type": "number",
                        "defaultValue": 115
                    },
                    "hipback": {
                        "type": "number",
                        "defaultValue": 65
                    },
                    "kneeup": {
                        "type": "number",
                        "defaultValue": 90
                    },
                    "kneedown": {
                        "type": "number",
                        "defaultValue": 30
                    },
                    "lean": {
                        "type": "number",
                        "defaultValue": 0
                    },
                    "sec": {
                        "type": "number",
                        "defaultValue": 0.75
                    },
                    "wtime": {
                        "type": "number",
                        "defaultValue": 1
                    }
                }
            }, {
                "opcode": "pose",
                "blockType": "command",
                "text": "Pose H0: [s0] H1: [s1] H2: [s2] H3: [s3] H4: [s4] H5: [s5] K6: [s6] K7: [s7] K8: [s8] K9: [s9] K10: [s10] K11: [s11] seconds: [wtime]",
                "arguments": {
                    "s0": {
                        "type": "number",
                        "defaultValue": 90
                    },
                    "s1": {
                        "type": "number",
                        "defaultValue": 90
                    },
                    "s2": {
                        "type": "number",
                        "defaultValue": 90
                    },
                    "s3": {
                        "type": "number",
                        "defaultValue": 90
                    },
                    "s4": {
                        "type": "number",
                        "defaultValue": 90
                    },
                    "s5": {
                        "type": "number",
                        "defaultValue": 90
                    },
                    "s6": {
                        "type": "number",
                        "defaultValue": 30
                    },
                    "s7": {
                        "type": "number",
                        "defaultValue": 30
                    },
                    "s8": {
                        "type": "number",
                        "defaultValue": 30
                    },
                    "s9": {
                        "type": "number",
                        "defaultValue": 30
                    },
                    "s10": {
                        "type": "number",
                        "defaultValue": 30
                    },
                    "s11": {
                        "type": "number",
                        "defaultValue": 30
                    },
                    "wtime": {
                        "type": "number",
                        "defaultValue": 1
                    }
                }
            }, {
                "opcode": "beep",
                "blockType": "command",
                "text": "Beep frequency: [freq] seconds: [duration]",
                "arguments": {
                    "freq": {
                        "type": "number",
                        "defaultValue": "300"
                    },
                    "duration": {
                        "type": "number",
                        "defaultValue": "0.3"
                    }
                }
            }, {
                "opcode": "readsensor",
                "blockType": "reporter",
                "text": "Sensor: [sensor]",
                "arguments": {
                    "sensor": {
                        "type": "string",
                        "menu": "sensors",
                        "defaultValue": "Analog 3"
                    }
                }
            }, {
                "opcode": "readcmucam5",
                "blockType": "reporter",
                "text": "CMUcam5: [sensor]",
                "arguments": {
                    "sensor": {
                        "type": "string",
                        "menu": "cmucam5vals",
                        "defaultValue": "x"
                    }
                }
            }, {
                "opcode": "recordstart",
                "blockType": "command",
                "text": "Record Start: [matrix] [dpad]",
                "arguments": {
                    "matrix": {
                        "type": "string",
                        "menu": "matrix",
                        "defaultValue": "Walk 1"
                    },
                    "dpad": {
                        "type": "string",
                        "menu": "dpad",
                        "defaultValue": "forward"
                    }
                }
            }, {
                "opcode": "recordend",
                "blockType": "command",
                "text": "Record End",
                "arguments": {}
            }, {
                "opcode": "eraserecordings",
                "blockType": "command",
                "text": "Erase Recordings",
                "arguments": {}
            }],
            "menus": {
                direction: this._formatMenu(['forward', 'backward', 'turn left', 'turn right', 'stomp/honk', 'stop']),
                yesno: this._formatMenu(['yes', 'no']),
                gait: this._formatMenu(['normal', 'high knees', 'small steps', 'scamper']),
                standstyle: this._formatMenu(['normal', 'tiptoes']),
                dancemove: this._formatMenu(['twist', 'twist on floor', 'twist legs up', 'twist other legs up', 'dab', 'ballet flutter', 'ballet left', 'ballet right', 'ballet forward', 'ballet backward', 'wave teeter', 'wave totter', 'wave ripple', 'wave swirl left', 'wave swirl right', 'stop']),
                armfightstyle: this._formatMenu(['single arms', 'unison arms']),
                armfightmove: this._formatMenu(['defend', 'lefthook', 'righthook', 'uppercut', 'downsweep', 'auto ninja']),
                fightadjust: this._formatMenu(['square up', 'thrust forward', 'thrust backward', 'lean left', 'lean right', 'lean forward', 'lean backward', 'twist hips right', 'twist hips left', 'freeze in place']),
                legs: this._formatMenu(['all', 'left', 'right', 'front', 'middle', 'back', 'tripod1', 'tripod2', '0', '1', '2', '3', '4', '5']),
                gaitdir: this._formatMenu(['forward', 'backward']),
                gaitstyle: this._formatMenu(['tripod', 'turn in place', 'ripple']),
                legopts: this._formatMenu(['mirror hips', 'raw hips']),
                sensors: this._formatMenu(['Ultrasonic distance', 'Analog 3', 'Analog 6', 'Analog 7']),
                cmucam5vals: this._formatMenu(['x', 'y', 'width', 'height', 'angle', 'object id']),
                matrix: this._formatMenu(['Walk 1', 'Walk 2', 'Walk 3', 'Walk 4', 'Dance 1', 'Dance 2', 'Dance 3', 'Dance 4', 'Fight 1', 'Fight 2', 'Fight 3', 'Fight 4']),
                dpad: this._formatMenu(['forward', 'backward', 'left', 'right', 'special', 'nothing pressed']),
                postype: this._formatMenu(['=', '+', '-']),
            }
        };
    }
    waitforconnection({
        callback
    }) {
        console.log("RECONNECT");
        if (device) {
            console.log("Stopping and restarting device:" + device.id);
            //device.set_receive_handler(null);
            //poller = null;
            device.close();

            // when the device actually completes opening we'll trigger
            // the Wait block callback
            deviceOpenedNotify = callback;
            device.open({
                stopBits: 0,
                bitRate: 9600,
                ctsFlowControl: 0
            }, deviceOpenedCallback);
        } else {
            tryNextDevice();
        }

    }
    standstill({
        style,
        wtime,
        callback
    }) {
        console.log("stand");

        var cmd = new Uint8Array(3);

        // standstyle: ["normal", "tiptoes", "floor", "foldup"],
        switch (style) {
            default:
            case "normal":
                cmd[0] = "W".charCodeAt();
                cmd[1] = "1".charCodeAt();
                cmd[2] = "s".charCodeAt();
                break;
            case "tiptoes":
                cmd[0] = "D".charCodeAt();
                cmd[1] = "2".charCodeAt();
                cmd[2] = "s".charCodeAt();
                break;
            case "floor":
                cmd[0] = "S".charCodeAt();
                cmd[1] = "1".charCodeAt();
                cmd[2] = "s".charCodeAt();
                break;
            case "foldup":
                cmd[0] = "S".charCodeAt();
                cmd[1] = "2".charCodeAt();
                cmd[2] = "s".charCodeAt();
                break;
        }

        window.setTimeout(function() {
            callback();
        }, wtime * 1000);

        setSimpleCommand(cmd.buffer);
        console.log("queued stand still " + style);
    }
    walk({
        ingait,
        indir,
        wtime,
        callback
    }) {

        var cmd = new Uint8Array(3);

        cmd[0] = "W".charCodeAt();

        // gait: ["normal", "high knees", "small steps", "scamper"],
        switch (ingait) {
            default:
            case "normal":
                cmd[1] = "1".charCodeAt();
                break;

            case "high knees":
                cmd[1] = "2".charCodeAt();
                break;

            case "small steps":
                cmd[1] = "3".charCodeAt();
                break;

            case "scamper":
                cmd[1] = "4".charCodeAt();
                break;
        }

        switch (indir) {
            default:
            case "forward":
                cmd[2] = "f".charCodeAt();
                break;

            case "backward":
                cmd[2] = "b".charCodeAt();
                break;

            case "turn left":
                cmd[2] = "l".charCodeAt();
                break;

            case "turn right":
                cmd[2] = "r".charCodeAt();
                break;

            case "stomp/honk":
                cmd[2] = "w".charCodeAt();
                break;

            case "stop":
                cmd[2] = "s".charCodeAt();
                break;

        }

        window.setTimeout(function() {
            callback();
        }, wtime * 1000);

        //curCmd = new Uint8Array(cmd.buffer);
        setSimpleCommand(cmd.buffer);

        console.log("sent walk " + ingait + " " + indir);
    }
    dance({
        dancemove,
        wtime,
        callback
    }) {
        console.log("dance");

        var cmd = new Uint8Array(3);

        cmd[0] = "D".charCodeAt();

        //dancemove: ["twist", "twist on floor", "twist legs up", "twist other legs up", "dab",
        switch (dancemove) {
            default:
            case "twist":
                cmd[1] = "1".charCodeAt();
                cmd[2] = "f".charCodeAt();
                break;
            case "twist on floor":
                cmd[1] = "1".charCodeAt();
                cmd[2] = "b".charCodeAt();
                break;
            case "twist legs up":
                cmd[1] = "1".charCodeAt();
                cmd[2] = "l".charCodeAt();
                break;
            case "twist other legs up":
                cmd[1] = "1".charCodeAt();
                cmd[2] = "r".charCodeAt();
                break;
            case "dab":
                cmd[1] = "1".charCodeAt();
                cmd[2] = "w".charCodeAt();
                break;

                // "ballet flutter", "ballet left", "ballet right", "ballet forward", "ballet backward",

            case "ballet flutter":
                cmd[1] = "2".charCodeAt();
                cmd[2] = "w".charCodeAt();
                break;
            case "ballet left":
                cmd[1] = "2".charCodeAt();
                cmd[2] = "l".charCodeAt();
                break;
            case "ballet right":
                cmd[1] = "2".charCodeAt();
                cmd[2] = "r".charCodeAt();
                break;
            case "ballet forward":
                cmd[1] = "2".charCodeAt();
                cmd[2] = "f".charCodeAt();
                break;
            case "ballet backward":
                cmd[1] = "2".charCodeAt();
                cmd[2] = "b".charCodeAt();
                break;

                // "wave teeter", "wave totter", "wave ripple", "wave swirl left", "wave swirl right"],
            case "wave teeter":
                cmd[1] = "3".charCodeAt();
                cmd[2] = "r".charCodeAt();
                break;
            case "wave totter":
                cmd[1] = "3".charCodeAt();
                cmd[2] = "l".charCodeAt();
                break;
            case "wave ripple":
                cmd[1] = "3".charCodeAt();
                cmd[2] = "w".charCodeAt();
                break;
            case "wave swirl left":
                cmd[1] = "3".charCodeAt();
                cmd[2] = "f".charCodeAt();
                break;
            case "wave swirl right":
                cmd[1] = "3".charCodeAt();
                cmd[2] = "b".charCodeAt();
                break;
            case "stop":
                cmd[1] = "3".charCodeAt();
                cmd[2] = "s".charCodeAt();
                break;

        }

        window.setTimeout(function() {
            callback();
        }, wtime * 1000);

        //curCmd = new Uint8Array(cmd.buffer);
        setSimpleCommand(cmd.buffer);
        console.log("queued dance " + dancemove);

    }
    fightarms({
        fightstyle,
        fightmove,
        wtime,
        callback
    }) {
        console.log("fightarms");

        var cmd = new Uint8Array(3);

        cmd[0] = "F".charCodeAt();

        // armfightstyle: ["single arms", "unison arms"],
        switch (fightstyle) {
            default:
            case "single arms":
                cmd[1] = "1".charCodeAt();
                break;
            case "unison arms":
                cmd[1] = "2".charCodeAt();
                break;
        }

        // armfightmove: ["defend", "lefthook", "righthook", "uppercut", "downsweep", "auto ninja"],
        switch (fightmove) {
            case "righthook":
                cmd[2] = "r".charCodeAt();
                break;
            case "lefthook":
                cmd[2] = "l".charCodeAt();
                break;
            case "uppercut":
                cmd[2] = "f".charCodeAt();
                break;
            case "downsweep":
                cmd[2] = "b".charCodeAt();
                break;
            case "auto ninja":
                cmd[2] = "w".charCodeAt();
                break;

            default:
            case "defend":
                cmd[2] = "s".charCodeAt();
                break;
        }

        window.setTimeout(function() {
            callback();
        }, wtime * 1000);

        //curCmd = new Uint8Array(cmd.buffer);
        setSimpleCommand(cmd.buffer);
        console.log("queued fight " + fightstyle + " " + fightmove);
    }
    fightadjust({
        adjuststyle,
        wtime,
        callback
    }) {
        console.log("fightadjust");

        var cmd = new Uint8Array(3);

        cmd[0] = "F".charCodeAt();

        //fightadjust: ["square up", "thrust forward", "thrust backward", "lean left", "lean right", "lean forward", "lean back upward", "twist hips right", "twist hips left", "freeze in place"],
        switch (adjuststyle) {
            default:
            case "square up":
                cmd[1] = "3".charCodeAt();
                cmd[2] = "w".charCodeAt();
                break;
            case "thrust forward":
                cmd[1] = "3".charCodeAt();
                cmd[2] = "f".charCodeAt();
                break;
            case "thrust backward":
                cmd[1] = "3".charCodeAt();
                cmd[2] = "b".charCodeAt();
                break;
            case "lean left":
                cmd[1] = "4".charCodeAt();
                cmd[2] = "l".charCodeAt();
                break;
            case "lean right":
                cmd[1] = "4".charCodeAt();
                cmd[2] = "r".charCodeAt();
                break;
            case "lean forward":
                cmd[1] = "4".charCodeAt();
                cmd[2] = "f".charCodeAt();
                break;
            case "lean backward":
                cmd[1] = "4".charCodeAt();
                cmd[2] = "b".charCodeAt();
                break;
            case "twist hips right":
                cmd[1] = "3".charCodeAt();
                cmd[2] = "r".charCodeAt();
                break;
            case "twist hips left":
                cmd[1] = "3".charCodeAt();
                cmd[2] = "l".charCodeAt();
                break;
            case "freeze in place":
                cmd[1] = "4".charCodeAt();
                cmd[2] = "s".charCodeAt();
                break;
        }

        //curCmd = new Uint8Array(cmd.buffer);
        setSimpleCommand(cmd.buffer);
        window.setTimeout(function() {
            callback();
        }, wtime * 1000);
        console.log("queued fight adjust " + adjuststyle);
    }
    setleg({
        legs,
        hippos,
        kneepos,
        opts,
        wtime,
        callback
    }) {
        console.log("setleg");

        var cmd = new Uint8Array(5);

        cmd[0] = "L".charCodeAt(); // code for SETLEG command, high bit on

        //legs: ["all", "left", "right", "front", "middle", "back", "tripod1", "tripod2", "0", "1", "2", "3", "4", "5"],
        // cmd[1] specifies a bitmask of legs
        switch (legs) {
            case "all":
                cmd[1] = Number(0b10111111); // bitmask, LSB is leg 0, etc.
                break;
            case "left":
                cmd[1] = Number(0b10000111); // legs 0, 1, 2
                break;
            case "right":
                cmd[1] = Number(0b10111000); // legs 3, 4, 5
                break;
            case "front":
                cmd[1] = Number(0b10100001); // legs 0, 5
                break;
            case "middle":
                cmd[1] = Number(0b10010010); // legs 1, 4
                break;
            case "back":
                cmd[1] = Number(0b10001100); // legs 2, 3
                break;
            case "tripod1":
                cmd[1] = Number(0b10010101); // legs 0, 2, 4
                break;
            case "tripod2":
                cmd[1] = Number(0b10101010); // legs 1, 3, 5
                break;
            case "0":
                cmd[1] = Number(0b10000001); // legs 0
                break;
            case "1":
                cmd[1] = Number(0b10000010); // legs 1
                break;
            case "2":
                cmd[1] = Number(0b10000100); // legs 2
                break;
            case "3":
                cmd[1] = Number(0b10001000); // legs 3
                break;
            case "4":
                cmd[1] = Number(0b10010000); // legs 4
                break;
            case "5":
                cmd[1] = Number(0b10100000); // legs 5
                break;
        }

        if (hippos > 180) {
            hippos = 180;
        } else if (hippos < 0) {
            hippos = 1;
        }
        if (kneepos > 180) {
            kneepos = 180;
        } else if (kneepos < 0) {
            kneepos = 0;
        }

        cmd[2] = hippos;
        cmd[3] = kneepos;

        //legopts: ["mirror hips", "raw hips"]
        //

        if (opts == "mirror hips") {
            cmd[4] = 0;
        } else {
            cmd[4] = 1;
        }
        setSimpleCommand(cmd.buffer);

        console.log("queued setleg " + legs + " " + hippos + " " + kneepos + " " + opts);

        window.setTimeout(function() {
            callback();
        }, wtime * 1000);

    }
    sethips({
        legs,
        hippos,
        opts,
        wtime,
        callback
    }) {
        console.log("sethips");

        var cmd = new Uint8Array(5);

        cmd[0] = "L".charCodeAt(); // code for SETLEG command, high bit on

        // cmd[1] specifies a bitmask of legs
        switch (legs) {
            case "all":
                cmd[1] = Number(0b10111111); // bitmask, LSB is leg 0, etc.
                break;
            case "left":
                cmd[1] = Number(0b10000111); // legs 0, 1, 2
                break;
            case "right":
                cmd[1] = Number(0b10111000); // legs 3, 4, 5
                break;
            case "front":
                cmd[1] = Number(0b10100001); // legs 0, 5
                break;
            case "middle":
                cmd[1] = Number(0b10010010); // legs 1, 4
                break;
            case "back":
                cmd[1] = Number(0b10001100); // legs 2, 3
                break;
            case "tripod1":
                cmd[1] = Number(0b10010101); // legs 0, 2, 4
                break;
            case "tripod2":
                cmd[1] = Number(0b10101010); // legs 1, 3, 5
                break;
            case "0":
                cmd[1] = Number(0b10000001); // legs 0
                break;
            case "1":
                cmd[1] = Number(0b10000010); // legs 1
                break;
            case "2":
                cmd[1] = Number(0b10000100); // legs 2
                break;
            case "3":
                cmd[1] = Number(0b10001000); // legs 3
                break;
            case "4":
                cmd[1] = Number(0b10010000); // legs 4
                break;
            case "5":
                cmd[1] = Number(0b10100000); // legs 5
                break;
        }

        if (hippos > 180) {
            hippos = 180;
        } else if (hippos < 0) {
            hippos = 1;
        }

        cmd[2] = hippos;
        cmd[3] = 255; // 255 is a special value, here means don't change knee positions

        //legopts: ["mirror hips", "raw hips"]

        if (opts == "mirror hips") {
            cmd[4] = 0;
        } else {
            cmd[4] = 1;
        }

        window.setTimeout(function() {
            callback();
        }, wtime * 1000);

        setSimpleCommand(cmd.buffer);

        console.log("queued sethips " + legs + " " + hippos + " " + opts);

    }
    setknees({
        legs,
        kneepos,
        wtime,
        callback
    }) {
        console.log("setknees");

        var cmd = new Uint8Array(5);

        cmd[0] = "L".charCodeAt(); // code for SETLEG command, high bit on

        // cmd[1] specifies a bitmask of legs
        switch (legs) {
            case "all":
                cmd[1] = Number(0b10111111); // bitmask, LSB is leg 0, etc.
                break;
            case "left":
                cmd[1] = Number(0b10000111); // legs 0, 1, 2
                break;
            case "right":
                cmd[1] = Number(0b10111000); // legs 3, 4, 5
                break;
            case "front":
                cmd[1] = Number(0b10100001); // legs 0, 5
                break;
            case "middle":
                cmd[1] = Number(0b10010010); // legs 1, 4
                break;
            case "back":
                cmd[1] = Number(0b10001100); // legs 2, 3
                break;
            case "tripod1":
                cmd[1] = Number(0b10010101); // legs 0, 2, 4
                break;
            case "tripod2":
                cmd[1] = Number(0b10101010); // legs 1, 3, 5
                break;
            case "0":
                cmd[1] = Number(0b10000001); // legs 0
                break;
            case "1":
                cmd[1] = Number(0b10000010); // legs 1
                break;
            case "2":
                cmd[1] = Number(0b10000100); // legs 2
                break;
            case "3":
                cmd[1] = Number(0b10001000); // legs 3
                break;
            case "4":
                cmd[1] = Number(0b10010000); // legs 4
                break;
            case "5":
                cmd[1] = Number(0b10100000); // legs 5
                break;
        }

        if (kneepos > 180) {
            kneepos = 180;
        } else if (kneepos < 1) {
            kneepos = 1;
        }

        cmd[2] = 255; // 255 is a special value, here means don't change hip positions;
        cmd[3] = kneepos;

        setSimpleCommand(cmd.buffer);

        console.log("queued setknees " + legs + " " + kneepos);

        window.setTimeout(function() {
            callback();
        }, wtime * 1000);

    }
    setservo({
        port,
        postype,
        pos,
        wtime,
        callback
    }) {
        console.log("setservo");

        var cmd = new Uint8Array(18);

        cmd[0] = "R".charCodeAt(); // "R" is for Raw Servo mode

        switch (postype) {
            default:
            case "=":
                cmd[1] = Number(0);
                break;
            case "+":
                cmd[1] = Number(1);
                break;
            case "-":
                cmd[1] = Number(2);
                break;
        }

        if (port > 15) {
            port = 15;
        } else if (port < 0) {
            port = 0;
        }

        for (var i = 2; i < 18; i++) {
            cmd[i] = 255; // default is no move
        }
        console.log("4");

        if (pos > 180 && pos < 254) { // 255 means "no move" and 254 means "detach"
            pos = 180;
        } else if (pos > 255) {
            pos = 255;
        } else if (pos < 1) {
            pos = 1;
        }
        console.log("5");

        cmd[port + 2] = pos;

        console.log("Set cmd port " + port + " to " + pos);

        window.setTimeout(function() {
            callback();
        }, wtime * 1000);

        setSimpleCommand(cmd.buffer);

        console.log("queued setservo " + port + " " + pos);

    }
    gait({
        style,
        dir,
        hipfwd,
        hipback,
        kneeup,
        kneedown,
        lean,
        sec,
        wtime,
        callback
    }) {
        console.log("gait");

        var cmd = new Uint8Array(10);

        cmd[0] = "G".charCodeAt(); // code for gait command

        // cmd[1] specifies type of gait
        // gaitstyle: ["tripod", "turn in place", "ripple", "sidestep"],
        switch (style) {
            case "turn in place":
                cmd[1] = Number(1);
                break;
            case "ripple":
                cmd[1] = Number(2);
                break;
            case "sidestep": // DOES NOT WORK YET
                cmd[1] = Number(3);
                break;
            default:
            case "tripod":
                cmd[1] = Number(0);
                break;
        }


        // cmd[2] specifies forward or backward direction
        switch (dir) {
            case "forward":
                cmd[2] = Number(0);
                break;
            case "backward":
                cmd[2] = Number(1);
                break;
        }

        cmd[3] = servorange(hipfwd);
        cmd[4] = servorange(hipback);
        cmd[5] = servorange(kneeup);
        cmd[6] = servorange(kneedown);

        if (lean < -70) {
            lean = -70;
        } else if (lean > 70) {
            lean = 70;
        }
        lean += 70; // we want it in the range 0 to 140 for transmission

        cmd[7] = lean;

        sec = sec * 1000; // convert to milliseconds
        if (sec < 100) {
            sec = 100;
        } else if (sec > 30000) {
            sec = 30000;
        }
        // milliseconds could overflow one byte so split it up
        cmd[8] = sec / 256;
        cmd[9] = sec % 256;

        window.setTimeout(function() {
            callback();
        }, wtime * 1000);

        setSimpleCommand(cmd.buffer);

        console.log("queued gait " + style + " " + dir);

    }
    pose({
        s0,
        s1,
        s2,
        s3,
        s4,
        s5,
        s6,
        s7,
        s8,
        s9,
        s10,
        s11,
        wtime,
        callback
    }) {
        console.log("pose");

        var cmd = new Uint8Array(13);

        cmd[0] = "P".charCodeAt(); // "P" is for Pose all 12 Servos mode
        cmd[1] = clipservo(s0);
        cmd[2] = clipservo(s1);
        cmd[3] = clipservo(s2);
        cmd[4] = clipservo(s3);
        cmd[5] = clipservo(s4);
        cmd[6] = clipservo(s5);
        cmd[7] = clipservo(s6);
        cmd[8] = clipservo(s7);
        cmd[9] = clipservo(s8);
        cmd[10] = clipservo(s9);
        cmd[11] = clipservo(s10);
        cmd[12] = clipservo(s11);

        window.setTimeout(function() {
            callback();
        }, wtime * 1000);

        setSimpleCommand(cmd.buffer);

        console.log("queued pose ");
    }
    beep({
        freq,
        duration,
        callback
    }) {
        console.log("beep");

        var cmd = new Uint8Array(5);

        cmd[0] = "B".charCodeAt(); // code for BEEP command, high bit on

        if (freq < 50) {
            freq = 50;
        } else if (freq > 2000) {
            freq = 2000;
        }

        freq = freq + 0; // convert to integer
        cmd[1] = freq / 256;
        cmd[2] = freq % 256;

        if (duration > 30) {
            duration = 30; // maximum time for tone in seconds
        } else if (duration < 1) {
            duration = 1;
        }
        // conver to milliseconds
        duration = (duration + 0); // convert to integer
        duration *= 1000;

        // output high byte first, then low
        cmd[3] = duration / 256;
        cmd[4] = duration % 256;

        setSimpleCommand(cmd.buffer);

        console.log("queued beep " + freq + " " + duration);
        window.setTimeout(function() {
            callback();
        }, duration);
    }
    readsensor({
        sensor
    }) {
        console.log("readsensor");
        switch (sensor) {
            default:
            case "Analog 3":
                return SensorA3;

            case "Analog 6":
                return SensorA6;

            case "Analog 7":
                return SensorA7;

            case "Ultrasonic distance":
                return SensorDistance;
        }
    }
    readcmucam5({
        sensor
    }) {
        console.log("readsensor");
        switch (sensor) {
            default:
            case "Analog 3":
                return SensorA3;

            case "Analog 6":
                return SensorA6;

            case "Analog 7":
                return SensorA7;

            case "Ultrasonic distance":
                return SensorDistance;
        }
    }
    recordstart({
        matrix,
        dpad
    }) {
        console.log("===RECORD START===");
        //Recording = 1;  // this is an optimization that isn't working right now because of robot protocol issues

        var cmd = new Uint8Array(5);

        cmd[0] = "R".charCodeAt();
        cmd[1] = "1".charCodeAt();

        switch (matrix) {
            default:
            case "Walk 1":
                cmd[2] = "W".charCodeAt();
                cmd[3] = "1".charCodeAt();
                break;
            case "Walk 2":
                cmd[2] = "W".charCodeAt();
                cmd[3] = "2".charCodeAt();
                break;
            case "Walk 3":
                cmd[2] = "W".charCodeAt();
                cmd[3] = "3".charCodeAt();
                break;
            case "Walk 4":
                cmd[2] = "W".charCodeAt();
                cmd[3] = "4".charCodeAt();
                break;
            case "Dance 1":
                cmd[2] = "D".charCodeAt();
                cmd[3] = "1".charCodeAt();
                break;
            case "Dance 2":
                cmd[2] = "D".charCodeAt();
                cmd[3] = "2".charCodeAt();
                break;
            case "Dance 3":
                cmd[2] = "D".charCodeAt();
                cmd[3] = "3".charCodeAt();
                break;
            case "Dance 4":
                cmd[2] = "D".charCodeAt();
                cmd[3] = "4".charCodeAt();
                break;
        }

        switch (dpad) {
            default:
            case "nothing pressed":
                cmd[4] = "s".charCodeAt();
                break;
            case "forward":
                cmd[4] = "f".charCodeAt();
                break;
            case "backward":
                cmd[4] = "b".charCodeAt();
                break;
            case "left":
                cmd[4] = "l".charCodeAt();
                break;
            case "right":
                cmd[4] = "r".charCodeAt();
                break;
            case "special":
                cmd[4] = "w".charCodeAt();
                break;
        }

        curCmdRec = new Uint8Array(cmd.buffer);
        curCmd = null; // we want to clear any commands in progress before starting the recording
        // otherwise you could have some leftover command from before that gets recorded by accident.
        console.log("queued RECORD START");
    }
    recordend({
        callback
    }) {
        console.log("record end");
        Recording = 0; // causing errors on the robot right now

        var cmd = new Uint8Array(5);

        cmd[0] = "R".charCodeAt();
        cmd[1] = "1".charCodeAt();
        cmd[2] = "S".charCodeAt();
        cmd[3] = "S".charCodeAt();
        cmd[4] = "S".charCodeAt();

        curCmdRec = new Uint8Array(cmd.buffer);
        console.log("queued record end");

        if (0) {
            window.setTimeout(function() {
                callback();
            }, 250); // we want to make sure the record end actually transmits
        }
    }
    eraserecordings({
        callback
    }) {
        console.log("erase recordings");
        Recording = 0;

        var cmd = new Uint8Array(5);

        cmd[0] = "R".charCodeAt();
        cmd[1] = "1".charCodeAt();
        cmd[2] = "D".charCodeAt();
        cmd[3] = "D".charCodeAt();
        cmd[4] = "D".charCodeAt();

        curCmdRec = new Uint8Array(cmd.buffer);
        console.log("queued erase recordings");

        if (0) {
            window.setTimeout(function() {
                callback();
            }, 250); // give time for recordings to actually erase
        }
    }
    _formatMenu(menu) {
        const m = [];
        for (let i = 0; i < menu.length; i++) {
            const obj = {};
            obj.text = menu[i];
            obj.value = i.toString();
            m.push(obj);
        }
        return m;
    }
}
Scratch.extensions.register(new VorpalCombatHexapod());
