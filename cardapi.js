/*! CardAPI v1.0.16-617dfd2 | (c) Appspace | https://docs.appspace.com/faq/legal/ */
function CardApi(type) {
    var modelUpdateCallback = null;
    var modeChangeCallback = null;
    var messagesCallback = null;
    var model = { inputs: [] };
    var mode = "tv";
    var inEditMode = false;
    var cardId;
    var themeProperty = {};
    var me = this;
    var hasNotifiedLoaded = false;
    var hasNotifiedComplete = false;
    var hasNotifiedError = false;
    var fontLookupCache = {};
    var self = this;
    var config = {};
    var deferCache = {};
    var deferRunningId = 0;
    var appWindow, appOrigin;

    //Gets a parameter from the current url query string
    function getLocationParameterByName(name) {
        var url = window.location.href.toLowerCase();
        name = name.replace(/[\[\]]/g, "\\$&").toLowerCase();
        var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
            results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, " "));
    }

    //Initializes the Card API and registers with the host
    this.init = function () {
        //Get the card id
        cardId = getLocationParameterByName("cardId");

        //Attempt to get the current mode from url query string
        mode = getLocationParameterByName("mode");
        //Attempt to load the default model
        $.getJSON("model.json", function (data) {

            //Check has it already been updated, if not use the default
            if (model.inputs.length == 0) {
                self.onModelUpdate(data);
            }
        });

        //Check are we in edit mode
        if (getLocationParameterByName("editing") == "true") {
            inEditMode = true;
            //console.log("in edit mode");
        }

        // Create IE + others compatible event handler
        var eventMethod = window.addEventListener ? "addEventListener" : "attachEvent";
        var eventer = window[eventMethod];
        var messageEvent = eventMethod == "attachEvent" ? "onmessage" : "message";
        //Set up parent window event listener for commands
        eventer(messageEvent, this.onParentMessage, false);

        //Let parent know we have initiaized the api
        raiseMessage({ message: "onapiready", cardId: cardId });
    }

    /***************** Parent Window Handlers *****************/
    this.onParentMessage = function (event) {
        if (!event.data || !event.data.message) {
            // console.log("Invalid event", event)
            return;
        }

        //If somone has subscribed, we forward them the message
        if (messagesCallback) {
            messagesCallback(event.data);
        }
        //console.log(event);
        var eventType = event.data.message.toLowerCase();
        switch (eventType) {
            case "api.init":
                config = event.data.config;
                if (model.inputs && model.inputs.length > 0) {
                    self.onModelUpdate(model);
                }
                /*console.log(config);
                self.api.xhr("http://date.jsontest.com", null)
                    .done(function () { console.log("done") })
                    .fail(function () { console.log("error") });*/
                break;
            case "onmodechange":
                me.onModeChange(event.data.mode);
                break;
            case "onmodelupdate":
                me.onModelUpdate(event.data.model);
                break;
            case "onexecutescript":
                me.onExecuteScript(event.data.script);
                break;
            case "oninjectcssclass":
                me.onInjectCssClass(event.data.className, event.data.css);
                break;
            case "oninjectthemeproperty":
                me.onInjectThemeProperty(event.data.name, event.data.value);
                break;
            case "api.response":
                me.processApiResponse(event.data);
                break;
            case "appspaceapp.webview.postmessage.init":
                appWindow = event.source;
                appOrigin = event.origin;
                //send on api ready
                raiseMessage({ message: "onapiready", cardId: cardId });
                break;
            case "appspaceapp.mswebview.postmessage.init":
                msMessaging = [];
                raiseMessage({ message: "onapiready", cardId: cardId });
                break;
        }
    }

    this.processApiResponse = function (response) {
        var defer = deferCache[response.requestId];
        if (defer) {
            //console.log(response);
            switch (response.event) {
                case "done":
                    defer.resolve(response.result, response);
                    break;
                case "fail":
                    defer.reject(response.result, response);
                    break;
            }
            deferCache[response.requestId] = undefined;
        }
    }

    this.api = {
        xhr: function (url, settings) {
            //If api is not implemented, use local implentation
            if (!config || !config.api || !config.api.xhr) {
                var jqxhr = $.ajax(url, settings);
                return jqxhr;
            }
            //Create our defer for tracking the request to the api
            var defer = $.Deferred();
            //Increment our defer id
            deferRunningId++;
            //Add to the cache
            deferCache[deferRunningId] = defer;
            //Pass the request to our api
            raiseMessage({ message: "api.xhr", $requestId: deferRunningId, url: url, settings: settings });
            //Return promise to api caller
            return defer.promise();
        },

        //Update a specific model input
        updateModelInput: function (input) {
            raiseMessage({ message: "api.updatemodelinput", input: input });
        },

        //Update custom data in the model
        updateModelCustomData: function (customData) {
            raiseMessage({ message: "api.updatemodelcustomdata", customData: customData });
        }
    }

    function substituteObjectValue(val) {
        if (val && config && config.properties) {
            for (var p in config.properties) {
                //Properties are $ {propName} in the value
                val = val.split("$" + "{property." + p + "}").join(config.properties[p]);
            }
        }
        return val;
    }

    function enumerateObjectProperties(obj) {
        switch (typeof obj) {
            case "number":
            case "boolean":
                return obj;
            case "string":
                return substituteObjectValue(obj);
            case "object":
                //Scan through child
                for (var p in obj) {
                    obj[p] = enumerateObjectProperties(obj[p]);
                }
                return obj;
        }
    }

    //Provides an updated model
    this.onModelUpdate = function (m) {
        if (m && m.inputs) {
            model = m;
            if (config && config.properties) {
                try {
                    //Process properties for substituion
                    enumerateObjectProperties(m);
                }
                catch (e) {
                    console.log(e);
                }

            }
            //scan through model for fonts to install
            installFontsFromModel().always(function () {
                if (modelUpdateCallback) {
                    modelUpdateCallback(m);
                }
            });
        }
    };

    //Updated the mode
    this.onModeChange = function (m) {
        mode = m;
        if (modeChangeCallback) {
            modeChangeCallback(m);
        }
    };

    //Execute Script
    this.onExecuteScript = function (script) {
        //Executes a script
        return eval(script);
    };
    //Injects a custom class and adds to the head
    this.onInjectCssClass = function (className, css) {
        className = className.toLowerCase();
        var found = false;
        //Iterate through the existing classes and update if already exists
        for (var k = 0; k < document.styleSheets.length; k++) {
            var sheet = document.styleSheets[k];
            var rules = sheet.cssRules || sheet.rules;
            for (var i = 0; i < rules.length; i++) {
                var rule = document.styleSheets[k].cssRules[i];
                var selector = rule.selectorText.toLowerCase();
                if (selector == className || selector == + className) {
                    rule.style.cssText = css;
                    //Found and updated
                    found = true;
                }
            }
        }
        //Check did we find the class and update?
        if (found) {
            //Exit as there is no need to add a new stle
            return;
        }
        //Create style class and inject into the head
        $("<style type='text/css'> " + className + " {" + css + "} </style>").appendTo("head");
    };
    //Injects a custom property for the theme
    this.onInjectThemeProperty = function (propertyName, value) {
        themeProperty[propertyName] = value;
    };

    function installFontsFromModel() {
        var defered = $.Deferred();
        var promises = [];
        //Find all input type for font upload
        for (var i = 0; i < model.inputs.length; i++) {
            var input = model.inputs[i];
            if (input.type == "fontupload" && input.value) {
                //Scan each file uploaded and load the referenced font
                for (var k = 0; k < input.value.length; k++) {
                    var fontObj = input.value[k];
                    if (fontObj.originalName) {
                        var family = fontObj.originalName.split(".")[0];
                        var font = {
                            family: family,
                            url: fontObj.path
                        };
                        var p = loadFont(font);
                        promises.push(p);
                    }
                }
            }
        }

        //Wait for all fonts to load
        $.when.apply($, promises).done(function () {
            //Wait for all promises to complete
            defered.resolve();
        });

        return defered.promise();
    }

    function loadFont(font) {
        var defered = $.Deferred();
        if (isFontAvailable(font.family)) {
            //console.log("Font family already installed: " + font.family);
            defered.resolve();
            return defered.promise();
        }
        //Create a sheet dynamicaly to load font
        var sheet = createSheet();
        var rule = "@font-face {font-family:'" + font.family + "'; src:url('" + font.url + "')}";
        sheet.insertRule(rule, 0);

        //Wait until font loads
        var loadTime = new Date().getTime();
        var intervalTimer = setInterval(function () {
            if (isFontAvailable(font.family)) {
                //Font loaded
                clearTimeout(intervalTimer);
                //console.log("Font family loaded: " + font.family);
                defered.resolve();
            }
            else {
                //Not loaded yet
            }
            //Check if it took longer than 3 seconds to load
            if (new Date().getTime() - loadTime > 3000) {
                //console.log("Took too long to load font");
                clearTimeout(intervalTimer);
                defered.resolve();
            }
        }, 10);

        return defered.promise();
    }

    //Create a style sheet
    function createSheet() {
        var style = document.createElement("style");
        // style.setAttribute("", "")
        style.appendChild(document.createTextNode(""));
        document.head.appendChild(style);
        return style.sheet;
    }

    //Check font exist by looking for size differences
    function isFontAvailable(fontName) {
        if (fontLookupCache[fontName]) {
            return true;
        }
        var sampleText = "abcdefghijklmnopqrstuvwxyz0123456789";
        var canvas = document.createElement("canvas");
        var context = canvas.getContext("2d");
        //Set default font to monospace so we can determine base size
        context.font = "72px monospace";
        var baseSize = context.measureText(sampleText).width;

        //Now check for our font, and fallback to monospace if it doesnt exist
        context.font = "72px '" + fontName + "', monospace";
        var fontSize = context.measureText(sampleText).width;
        //If they are the same then the font doesnt exist
        if (fontSize != baseSize) {
            fontLookupCache[fontName] = true;
            return true;
        } else {
            return false;
        }
    }





    /***************** Raise Notifications *****************/
    function raiseMessage(message) {
        if (appOrigin && appWindow) {
            appWindow.postMessage(message, appOrigin);
        } else if (msMessaging) {
            msMessaging.push(message);
        } else if (window && window.parent && window.parent.postMessage) {
            window.parent.postMessage(message, "*");
        }
    }

    //Let the host know that your card has loaded
    this.notifyOnLoad = function (p) {
        //Have we already sent this notification
        if (hasNotifiedLoaded) {
            return;
        }
        hasNotifiedLoaded = true;
        raiseMessage({ message: "loaded", cardId: cardId });
    };
    //Let the host know your card has completed playbacl
    this.notifyOnComplete = function (p) {
        //Have we already sent this notification
        if (hasNotifiedComplete) {
            return;
        }
        hasNotifiedComplete = true;
        raiseMessage({ message: "complete", cardId: cardId });
    };
    //Let the host know your card has had an error during load or playback
    this.notifyOnError = function (p) {
        //Have we already sent this notification
        if (hasNotifiedError) {
            return;
        }
        hasNotifiedError = true;
        raiseMessage({ message: "error", cardId: cardId });
    };

    /***************** Subscribe to Events *****************/

    //Subscribes to model changes
    this.subscribeModelUpdate = function (callback) {
        modelUpdateCallback = callback;
    };

    //Subscribes to mode changes
    this.subscribeModeChange = function (callback) {
        modeChangeCallback = callback;
    };

    //Subscribes to messages
    this.subscribeToMessages = function (callback) {
        messagesCallback = callback;
    };

    //Returns the card model
    this.getModel = function () {
        return model;
    };

    //Returns the template config
    this.getConfig = function () {
        return config;
    };

    //Returns the display mode of the card
    this.getMode = function () {
        return mode;
    };

    //Returns a theme property
    this.getThemeProperty = function (propertyName) {
        return themeProperty[propertyName];
    };

    //Returns true or false depending on whether the card is currently being edited
    this.isEditing = function () {
        return inEditMode;
    };

    //Gets the input model for a specific property
    this.getModelProperty = function (propertyName) {
        propertyName = propertyName.toLowerCase();
        if (model && model.inputs) {
            for (var i = 0; i < model.inputs.length; i++) {
                var p = model.inputs[i];
                if (p.name.toLowerCase() == propertyName) {
                    return p;
                }
            }
        }
        return null;
    };
}

//Creates a global instance of the CardAPI
var $cardApi = new CardApi();
//Disable auto
//$cardApi.init();

//global function for ms-webview post messaging
function globalMsPostMessaging(message) {
    //'{"message":"abcd"}'
    var messageObject = JSON.parse(message);
    var event = {
        data: messageObject
    }
    $cardApi.onParentMessage(event);
}

var msMessaging;
//global function for ms-webview retrieve messaging
function globalMsRetrieveMessaging() {
    var message = '[]';
    if (msMessaging) {
        message = JSON.stringify(msMessaging);
        msMessaging = [];
    }
    return message;
}

//export to global
window.msPostMessaging = globalMsPostMessaging;
window.msRetrieveMessaging = globalMsRetrieveMessaging;