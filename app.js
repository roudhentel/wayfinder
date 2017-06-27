var mainApp = angular.module("mainApp", ["onScreenKeyboard"]);

mainApp.directive("inputResize", function ($window, $timeout) {
    return {
        restrict: 'A',
        link: function (scope, el, attb) {
            $timeout(function () {
                el[0].style["font-size"] = (el[0].clientHeight - 15) + 'px';
                updateBtnSubmitFontSize(el);
            });

            angular.element($window).bind('resize', function (ev) {
                el[0].style["font-size"] = (el[0].clientHeight - 15) + 'px';
                updateBtnSubmitFontSize(el);
            });

            var updateBtnSubmitFontSize = function (el) {
                if (angular.element($("#btnSubmit"))[0]) {
                    var newFontSize = (el[0].clientHeight - 25) < 12 ? 12 : (el[0].clientHeight - 25);
                    angular.element($("#btnSubmit"))[0].style["font-size"] = newFontSize + 'px';
                    angular.element($("#btnSubmit"))[0].style["line-height"] = newFontSize + 'px';
                }
            }
        }
    }
});

mainApp.controller("mainCtrl", function ($scope, $window, $timeout, $http, $interval) {
    var cfg = {
        deviceid: "SCA10001",
        uuid: "1000001",
        portalUrl: "http://scawayfinder-portal.azurewebsites.net"
    }

    var s = undefined,
        movingBall = undefined,
        lineDirection = undefined,
        timeoutCounter = 0;
    $scope.disableButton = false;
    $scope.loadingFlag = false;

    $scope.timerTimeout = undefined;
    $scope.timerEnable = false;
    $scope.timerCount = 65;

    $scope.resetTimer = function () {
        timeoutCounter = 0;
    }

    // local storage
    // 1. store -- store details
    // 2. products -- store products
    // 3. routes -- store product's routes
    // 4. maps -- store maps
    // 5. primaryMap -- store primary map details
    // 6. mapData -- primaryMap base64 data
    // 7. aisleRoutes -- map aisle's routes
    var loc = window.localStorage;

    $scope.gblVar = {
        store: {},                  // store details
        products: [],               // list products
        selectedItem: {},           // selected product from search
        searchResult: [],           // search results
        searchText: "",             // search text
        maps: [],                   // store's list of maps
        primaryMap: {},             // store's primary map
        routes: [],                 // all product routes
        selectedRouteId: 0,         // selected route id
        routePlayed: 0,             // route that will be played
        mapData: "",                // base 64 data of the map
        currentPage: 0,             // 0 - start page, 1 - search page, 2 - result page
        continueAnimation: false,   // variable handler for the result animation of route (this is to stop the animation)
        mode: "",                   // card mode
        welcomeMsg: "",             // card welcome message
        clickToStartMsg: "",        // click to start message
        bgImage: "",                // background image
        bgVideo: "",                // background video
        showVideo: false,           // show video variable holder
        showImage: false,           // show image variable holder
        keyboardRows: [             // keyboard keys    
            ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
            ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
            ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', { type: 'erase', text: '&lArr;' }],
            [{ type: 'shift', upperCase: '&dArr;', lowerCase: '&uArr;' }, 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.'],
            [{ type: 'space', colspan: 10, text: ' ' }]
        ],
        playerProperty: {},         // player property
        otherRoutes: [],            // other routes of selected product
        listLogs: [],               // error logs
        aisleRoutes: [],            // aisle routes
        listAisle: []               // all store's aisles
    };
    var pointerPos = -1;
    var isUpperCase = false;
    $scope.getText = function (key) {
        if (key instanceof Object) {
            if (key.type === 'shift') {
                return isUpperCase ? key.lowerCase : key.upperCase;
            }
            return key.text;
        }

        return key;
    }

    $scope.showArrowUp = function () {
        return $(".result-holder").scrollTop() > 0;
    }

    $scope.showArrowDown = function () {
        return $(".result-holder").scrollTop() + $(".result-holder").height() < $(".result-holder").get(0).scrollHeight;
    }

    $scope.showArrowUp_1 = function () {
        return $(".rows-data").scrollTop() > 0;
    }

    $scope.showArrowDown_1 = function () {
        return $(".rows-data").scrollTop() + $(".rows-data").height() < $(".rows-data").get(0).scrollHeight;
    }

    $scope.scroll = function (direction) {
        var curr = $(".result-holder").scrollTop();
        if (direction === "up") {
            curr -= 100;
            curr = curr < 0 ? 0 : curr;
            $(".result-holder").animate({ scrollTop: curr });
        } else {
            curr += 100;
            curr = curr > $(".result-holder").get(0).scrollHeight ? $(".result-holder").get(0).scrollHeight : curr;
            $(".result-holder").animate({ scrollTop: curr });
        }
    }

    $scope.scroll_1 = function (direction) {
        var curr = $(".rows-data").scrollTop();
        if (direction === "up") {
            curr -= 100;
            curr = curr < 0 ? 0 : curr;
            $(".rows-data").animate({ scrollTop: curr });
        } else {
            curr += 100;
            curr = curr > $(".rows-data").get(0).scrollHeight ? $(".rows-data").get(0).scrollHeight : curr;
            $(".rows-data").animate({ scrollTop: curr });
        }
    }

    $scope.keyboardClick = function (key) {
        if (key instanceof Object) {
            if (key.type === 'shift') {
                $scope.gblVar.keyboardRows.forEach((obj, idx) => {
                    obj.forEach((k, i) => {
                        if (k instanceof Object) {

                        } else {
                            $scope.gblVar.keyboardRows[idx][i] = isUpperCase ? k.toLowerCase() : k.toUpperCase();
                        }
                    });
                });
                isUpperCase = !isUpperCase;
            } else if (key.type === 'erase') {
                $scope.gblVar.searchText = pointerPos === -1 ? $scope.gblVar.searchText.substring(0, $scope.gblVar.searchText.length - 1) :
                    [$scope.gblVar.searchText.slice(0, pointerPos).substring(0, $scope.gblVar.searchText.slice(0, pointerPos).length - 1), $scope.gblVar.searchText.slice(pointerPos)].join('');
                $scope.querySearch($scope.gblVar.searchText);
                pointerPos = pointerPos === -1 ? pointerPos : pointerPos - 1;
            } else {
                $scope.gblVar.searchText = pointerPos === -1 ? $scope.gblVar.searchText + key.text :
                    [$scope.gblVar.searchText.slice(0, pointerPos), key.text, $scope.gblVar.searchText.slice(pointerPos)].join('');
                $scope.querySearch($scope.gblVar.searchText);
                pointerPos = pointerPos === -1 ? pointerPos : pointerPos + 1;
            }

        } else {
            $scope.gblVar.searchText = pointerPos === -1 ? $scope.gblVar.searchText + key :
                [$scope.gblVar.searchText.slice(0, pointerPos), key, $scope.gblVar.searchText.slice(pointerPos)].join('');
            $scope.querySearch($scope.gblVar.searchText);
            pointerPos = pointerPos === -1 ? pointerPos : pointerPos + 1;
        }
    }

    $scope.setPointerPos = function (ev) {
        pointerPos = ev.currentTarget.selectionStart;
    }

    // function for moving page
    $scope.movePageTo = function (pageNo) {
        if (pageNo.toString() === "0") {
            $scope.timerCount = 65;
            $scope.timerEnable = false;
            $interval.cancel($scope.timerTimeout);
            $scope.gblVar.selectedItem = {};
            $scope.gblVar.searchResult = [];
            $scope.gblVar.searchText = "";
            $timeout(() => {
                $('#bgVideo').get(0).currentTime = 0;
            });
        }

        if (pageNo.toString() === "1") {
            if (!$scope.gblVar.store.Id || $scope.loadingFlag) {
                return;
            }

            setTimeout(() => {
                $(".result-holder").bind('scroll', (e) => {
                    timeoutCounter = 0;
                });
            }, 10);

            $scope.timerCount = 65;
            $scope.timerEnable = true;
            $scope.timerTimeout = $interval(() => {
                if (!$scope.timerEnable) return;
                // 65 secs inactive will redirect to splash page
                if (timeoutCounter >= $scope.timerCount) {
                    timeoutCounter = 0;
                    $scope.movePageTo(0);
                }

                timeoutCounter++;
            }, 1000);

            $(".keyboard").focus();
            setTimeout(() => {
                $("#srch-term").focus();
            }, 100);

            if ($scope.gblVar.searchResult.length > 0) {
                $scope.gblVar.selectedItem = {};
            }
        }

        if (pageNo.toString() === "2") {
            $scope.timerCount = 65;

            setTimeout(() => {
                $scope.gblVar.selectedRouteId = 0
                s = Snap("#svg");
                $scope.changeMap($scope.gblVar.searchResult.length === 0);

                $scope.gblVar.continueAnimation = false;
                s.selectAll("polyline").forEach(function (elem) { elem.stop(); });
                s.selectAll("circle").forEach(function (elem) { elem.stop(); });

                setTimeout(() => {
                    $(".rows-data").bind('scroll', (e) => {
                        timeoutCounter = 0;
                    });
                }, 10);
            }, 100);
        }

        $scope.gblVar.currentPage = pageNo;
    }

    var getStoreDetails = function () {
        // get store data
        $http({
            method: "GET",
            url: cfg.portalUrl + "/api/store/getbyuuid",
            params: {
                uuid: cfg.uuid
            }
        }).then(function (result) {
            if (result.data.success) {
                var rows = result.data.rows;
                if (rows.length > 0) {
                    loc.setItem("store", JSON.stringify(rows[0]));
                    $scope.gblVar.store = rows[0];

                    getStoreData();
                }
            } else {
                if (loc.getItem("store")) {
                    $scope.gblVar.store = JSON.parse(loc.getItem("store"));
                    getStoreData();
                }
            }
        }, function (error) {
            console.log(error);
            $scope.gblVar.listLogs.push(error);
            if (loc.getItem("store")) {
                $scope.gblVar.store = JSON.parse(loc.getItem("store"));
                getStoreData();
            }
        });
    }

    var getStoreData = function () {
        // get all products
        $http({
            method: "GET",
            url: cfg.portalUrl + "/api/product/getAllByUuid",
            params: {
                "uuid": cfg.uuid
            }
        }).then(function (result) {
            if (result.data.success) {
                loc.setItem("products", JSON.stringify(result.data.rows));
                $scope.gblVar.products = result.data.rows;
            } else {
                if (loc.getItem("products")) {
                    $scope.gblVar.products = JSON.parse(loc.getItem("products"));
                }
            }
        }, function (error) {
            console.log(error);
            $scope.gblVar.listLogs.push(error);
            if (loc.getItem("products")) {
                $scope.gblVar.products = JSON.parse(loc.getItem("products"));
            }
        });

        // store product's routes
        $http({
            method: "GET",
            url: cfg.portalUrl + "/api/map/getallroutesbyuuid",
            params: {
                "uuid": cfg.uuid
            }
        }).then(function (response) {
            if (response.data.success) {
                var rows = response.data.rows;
                loc.setItem("routes", JSON.stringify(rows));
                $scope.gblVar.routes = rows;
            } else {
                if (loc.getItem("routes")) {
                    $scope.gblVar.routes = JSON.parse(loc.getItem("routes"));
                }
            }
        }, function (error) {
            console.log(error);
            $scope.gblVar.listLogs.push(error);
            if (loc.getItem("routes")) {
                $scope.gblVar.routes = JSON.parse(loc.getItem("routes"));
            }
        });

        // store aisle's routes
        $http({
            method: "GET",
            url: cfg.portalUrl + "/api/aisle/getRoutesByUuid",
            params: {
                storeuuid: cfg.uuid,
                mapid: 0,
                aisleid: 0
            }
        }).then(function (response) {
            if (response.data.success) {
                loc.setItem("aisleRoutes", JSON.stringify(response.data.rows));
                $scope.gblVar.aisleRoutes = response.data.rows;
            } else {
                if (loc.getItem("aisleRoutes")) {
                    $scope.gblVar.aisleRoutes = JSON.parse(loc.getItem("aisleRoutes"));
                }
            }
        }, function (error) {
            console.log(error);
            $scope.gblVar.listLogs.push(error);
            if (loc.getItem("aisleRoutes")) {
                $scope.gblVar.aisleRoutes = JSON.parse(loc.getItem("aisleRoutes"));
            }
        });

        // get all store Aisles
        $http({
            method: "GET",
            url: cfg.portalUrl + "/api/aisle/getByStoreId",
            params: {
                id: $scope.gblVar.store.Id
            }
        }).then(function (res) {
            if (res.data.success) {
                loc.setItem("listAisle", JSON.stringify(res.data.rows));
                $scope.gblVar.listAisle = res.data.rows;
            } else {
                if (loc.getItem("listAisle")) {
                    $scope.gblVar.listAisle = JSON.parse(loc.getItem("listAisle"));
                }
            }
        }, function (err) {
            console.log(err);
            if (loc.getItem("listAisle")) {
                $scope.gblVar.listAisle = JSON.parse(loc.getItem("listAisle"));
            }
        });

        // get maps
        $http({
            method: "GET",
            url: cfg.portalUrl + "/api/map/getallbyuuid",
            params: {
                "uuid": cfg.uuid
            }
        }).then(function (response) {
            if (response.data.success) {
                // set maps data
                var rows = response.data.rows;
                loc.setItem("maps", JSON.stringify(rows));
                $scope.gblVar.maps = rows;

                // set primary map data
                var primaryMap = $scope.gblVar.maps.find(obj => obj.IsPrimary === 1);
                $scope.gblVar.primaryMap = primaryMap ? primaryMap : rows.length > 0 ? rows[0] : {};
                loc.setItem("primaryMap", JSON.stringify($scope.gblVar.primaryMap));


                var img = $("#imgBg")[0],
                    src = cfg.portalUrl + "/assets/maps/" + $scope.gblVar.store.Id + "/" + $scope.gblVar.primaryMap.Filename;
                img.crossOrigin = "Anonymous";

                img.onload = function () {
                    var data = getBase64Image(this);
                    loc.setItem("mapData", data);
                    $scope.gblVar.mapData = data;
                    $scope.loadingFlag = false;
                    $window.$cardApi.notifyOnLoad(); // notify when load is complete
                    $scope.$digest();
                }
                img.src = cfg.portalUrl + "/assets/maps/" + $scope.gblVar.store.Id + "/" + $scope.gblVar.primaryMap.Filename;

                img.src = src;
                // make sure the load event fires for cached images too
                if (img.complete || img.complete === undefined) {
                    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
                    img.src = src;
                }
            } else {
                if (loc.getItem("maps"))
                    $scope.gblVar.maps = JSON.parse(loc.getItem("maps"));
                if (loc.getItem("mapData")) {
                    $scope.gblVar.mapData = loc.getItem("mapData");
                    $window.$cardApi.notifyOnLoad(); // notify when load is complete
                    $scope.loadingFlag = false;
                }
                if (loc.getItem("primaryMap"))
                    $scope.gblVar.primaryMap = JSON.parse(loc.getItem("primaryMap"));
            }
        }, function (error) {
            $scope.gblVar.listLogs.push(error);
            console.log(error);
            if (loc.getItem("maps"))
                $scope.gblVar.maps = JSON.parse(loc.getItem("maps"));
            if (loc.getItem("mapData")) {
                $scope.gblVar.mapData = loc.getItem("mapData");
                $window.$cardApi.notifyOnLoad(); // notify when load is complete
                $scope.loadingFlag = false;
            }
            if (loc.getItem("primaryMap"))
                $scope.gblVar.primaryMap = JSON.parse(loc.getItem("primaryMap"));
        });

    }

    var getBase64Image = function (img) {
        var canvas = document.createElement('canvas');
        var context = canvas.getContext('2d');

        canvas.width = img.width;
        canvas.height = img.height;

        context.drawImage(img, 0, 0, img.width, img.height);

        return canvas.toDataURL("image/png");
    }

    $scope.updateData = function () {
        loc.clear();
        getStoreDetails();
    }

    // begin search page functions
    $scope.addNewSearchTerm = function (searchText) {
        var locSearchTerms = loc.getItem("searchTerms")
        var searchTerms = locSearchTerms ? JSON.parse(locSearchTerms) : [];
        var newSearchTerm = {
            searchText: searchText,
            storeUuid: cfg.uuid,
            deviceId: cfg.deviceid
        }
        searchTerms.push(newSearchTerm);
        loc.setItem("searchTerms", JSON.stringify(searchTerms));
    }

    $scope.querySearch = function (query) {
        if (!query || query === "") {
            $scope.gblVar.searchResult = [];
        } else {
            $scope.gblVar.searchResult = $scope.gblVar.products.filter(obj =>
                obj.Name.toLowerCase().indexOf(query.toLowerCase()) > -1 ||
                obj.Category.toLowerCase().indexOf(query.toLowerCase()) > -1); //||
                //obj.Occasion.toLowerCase().indexOf(query.toLowerCase()) > -1);
        }

        $scope.gblVar.selectedItem = {};
    }

    $scope.setSelectedItem = function (item) {
        $scope.gblVar.selectedItem = item;
        $scope.gblVar.searchText = item.Name;
        $scope.gblVar.searchResult = [];

        $scope.gblVar.otherRoutes = $scope.gblVar.routes.filter(obj => obj.MapId === $scope.gblVar.primaryMap.Id && $scope.gblVar.selectedItem.Id === obj.ProductId);
        var productAisleRoutes = $scope.gblVar.aisleRoutes.filter(obj => item.AisleNumber.indexOf(obj.AisleId.toString()) > -1 && obj.MapId === $scope.gblVar.primaryMap.Id);
        $scope.gblVar.otherRoutes.push.apply($scope.gblVar.otherRoutes, productAisleRoutes);

        $scope.select();
    }

    $scope.clearSearch = function () {
        $scope.gblVar.searchText = "";
        $scope.gblVar.selectedItem = {};
        $scope.gblVar.searchResult = [];
    }

    $scope.getDescription = function (aislenum) {
        var arr = aislenum.split(","),
            newDesc = "";
        arr.forEach(item => {
            var a = $scope.gblVar.listAisle.find(aisle => aisle.Id === parseInt(item));
            newDesc += a ? (a.Description + ", ") : "";
        });
        newDesc = newDesc.length > 0 ? newDesc.substring(0, newDesc.length - 2) : newDesc;
        return newDesc;
    }

    $scope.select = function () {
        $scope.movePageTo(2);

        $scope.addNewSearchTerm($scope.gblVar.searchText);
    }
    // end search page functions

    // begin result page functions
    $scope.changeMap = function (animate) {
        if ($scope.image) $scope.image.remove();

        if ($scope.gblVar.primaryMap) {
            s.attr({
                "viewBox": "0 0 " + $scope.gblVar.primaryMap.Width + " " + $scope.gblVar.primaryMap.Height
            });

            $scope.image = s.image($scope.gblVar.mapData, 0, 0, 100, 100).attr({
                width: "100%",
                height: "100%"
            });

            if (animate) {
                setTimeout(() => {
                    $scope.viewOnMap(0);
                }, 1000);
            }

        }
    }

    $scope.viewOnMap = function (route) {
        // remove all circles first
        s.selectAll("circle").remove();
        s.selectAll("polyline").remove();

        // parse array
        var directions = [];


        // var selectedroute = routeid > 0 ? $scope.gblVar.routes.find(obj => obj.Id.toString() === routeid.toString())
        //     : $scope.gblVar.routes.find(obj => obj.MapId.toString() === $scope.gblVar.primaryMap.Id.toString() &&
        //         $scope.gblVar.selectedItem.Id.toString() === obj.ProductId.toString());

        //var selectedroute = route === 0 && $scope.gblVar.otherRoutes.length > 0 ? $scope.gblVar.otherRoutes[0] : route;
        var selectedroute = $scope.gblVar.otherRoutes[$scope.gblVar.routePlayed];

        if (selectedroute) {
            //$scope.gblVar.selectedRouteId = selectedroute.Id.toString();
            var dir = selectedroute.Coordinates.split(",")
            var ctr = 1;
            for (let x = 1; x < dir.length; x += 2) {
                directions.push({
                    x: dir[x - 1],
                    y: dir[x]
                });
            }

            if (movingBall) movingBall.remove();
            movingBall = s.circle(directions[0].x, directions[0].y, 20);
            movingBall.attr({
                fill: '#f00',
                stroke: '#000',
                strokeWidth: 1
            });
            s.circle(directions[0].x, directions[0].y, 20).attr({ "fill": "green" });

            if (lineDirection) lineDirection.remove();
            lineDirection = s.polyline().attr({
                points: directions[0].x + "," + directions[0].y,
                fill: "none",
                stroke: "black",
                strokeWidth: 10,
                strokeDasharray: "10",
                strokeDashoffset: 50,
                strokeLinejoin: "round"
            });

            $scope.disableButton = true;
            $scope.gblVar.continueAnimation = true;
            moveBall(directions, 1);
        }
    }

    var moveBall = function (directions, idx) {
        // get distance beetween points
        var a = directions[idx - 1].x - directions[idx].x;
        var b = directions[idx - 1].y - directions[idx].y;
        var distance = Math.sqrt(a * a + b * b);
        // calculate speed for transition
        var speed = (distance / 120) * 250;

        movingBall.animate({
            cx: directions[idx].x,
            cy: directions[idx].y
        }, speed, function () {
            if ((idx + 1) < directions.length) {
                //s.circle(directions[idx].x, directions[idx].y, 15).attr({ "fill": "blue" });
                if ($scope.gblVar.continueAnimation) {
                    moveBall(directions, ++idx);
                }
            } else {
                $scope.timerCount = 15;
                timeoutCounter = 0;
                $scope.disableButton = false;
                $scope.$digest();
            }
        });
        var from = [parseInt(directions[idx - 1].x), parseInt(directions[idx - 1].y)];
        var to = [parseInt(directions[idx].x), parseInt(directions[idx].y)];
        Snap.animate(from, to, function (value) {
            lineDirection.attr({
                points: lineDirection.node.attributes["points"].value + "," + value[0] + "," + value[1]
            });
        }, speed);

    }

    $scope.setSelectedItemV1 = function (item, animate) {
        $scope.gblVar.selectedItem = item;
        $scope.otherViews = $scope.gblVar.routes.filter(obj => obj.MapId === $scope.gblVar.primaryMap.Id && $scope.gblVar.selectedItem.Id === obj.ProductId);
        if (animate) {
            setTimeout(() => {
                $scope.viewOnMap(0);
            }, 1000);
        }

        $scope.gblVar.otherRoutes = $scope.gblVar.routes.filter(obj => obj.MapId === $scope.gblVar.primaryMap.Id && $scope.gblVar.selectedItem.Id === obj.ProductId);
        var productAisleRoutes = $scope.gblVar.aisleRoutes.filter(obj => item.AisleNumber.indexOf(obj.AisleId.toString()) > -1 && obj.MapId === $scope.gblVar.primaryMap.Id);
        $scope.gblVar.otherRoutes.push.apply($scope.gblVar.otherRoutes, productAisleRoutes);
        $scope.addNewSearchTerm(item.Name);
    }

    // end result page functions

    var init = function () {
        //Subscribe to updates on the card model
        $window.$cardApi.subscribeModelUpdate(onModelUpdate)

        //subscribe to mode change
        $window.$cardApi.subscribeModeChange(onModeChange);

        //initialize card api
        $window.$cardApi.init();

        // get player config
        var tcfg = $window.$cardApi.getConfig();
        if (tcfg && tcfg.properties) {
            cfg.deviceid = tcfg.properties["DeviceId"] ? tcfg.properties["DeviceId"] : cfg.deviceid;
            cfg.uuid = tcfg.properties["Store.UUID"] ? tcfg.properties["Store.UUID"] : cfg.uuid;
            cfg.portalUrl = tcfg.properties["PortalUrl"] ? tcfg.properties["PortalUrl"] : cfg.portalUrl;
            $scope.gblVar.playerProperty = tcfg.properties;
        }
    }

    var onModeChange = function (m) {
        $scope.gblVar.mode = m;

        $scope.$digest();
    };


    var loaded = false;
    var waitingOnBgVideoLoad = false;
    var onModelUpdate = function () {
        $timeout(function () {
            loaded = false;

            var tuuid = $window.$cardApi.getModelProperty("uuid");
            cfg.uuid = tuuid && tuuid.value ? tuuid.value : "";
            $scope.gblVar.welcomeMsg = $window.$cardApi.getModelProperty("welcomemsg");
            $scope.gblVar.clickToStartMsg = $window.$cardApi.getModelProperty("clicktostart");
            $scope.gblVar.routePlayed = $window.$cardApi.getModelProperty("routeplayed") ? $window.$cardApi.getModelProperty("routeplayed").value : 0;

            var imgVideo = $window.$cardApi.getModelProperty("bgImage");
            $scope.gblVar.bgImage = imgVideo.value && imgVideo.value.bgImage ? imgVideo.value.bgImage : undefined;

            var bgEl = $("#bgImage");
            var bgVideoEl = $("#bgVideo");
            if ($scope.gblVar.bgImage) {
                if ($scope.gblVar.bgImage.toLowerCase().endsWith(".mp4") || $scope.gblVar.bgImage.toLowerCase().endsWith(".mov")) {
                    //Show video, hide image
                    $scope.gblVar.showVideo = true;
                    bgVideoEl[0].style.display = "";
                    bgEl[0].style.display = "none";
                    if (bgVideoEl[0].src != $scope.gblVar.bgImage) {
                        bgVideoEl[0].src = $scope.gblVar.bgImage;
                        bgVideoEl[0].removeEventListener('timeupdate', onBgVideoLoad);
                        bgVideoEl[0].removeEventListener('error', onBgVideoLoadFail);
                        bgVideoEl[0].addEventListener('timeupdate', onBgVideoLoad, false);
                        bgVideoEl[0].addEventListener('error', onBgVideoLoadFail, false);
                        waitingOnBgVideoLoad = true;
                    }
                }
                else {
                    waitingOnBgVideoLoad = false;
                    $scope.gblVar.showImage = true;
                    //Show image, hide video
                    bgEl[0].style.display = "";
                    bgVideoEl[0].style.display = "none";
                    //Check do we need to update the source
                    if (bgEl[0].src != $scope.gblVar.bgImage) {
                        // bgEl[0].onload = function () {
                        //     $scope.repositionElements();
                        // };
                        bgEl[0].src = $scope.gblVar.bgImage;
                    }
                }
            } else {
                notifyLoaded();
            }
        });

        //$scope.$digest();
    }

    function onBgVideoLoad() {
        waitingOnBgVideoLoad = false;
        var bgVideoEl = $("#bgVideo");
        bgVideoEl[0].removeEventListener('timeupdate', onBgVideoLoad, false);
        $timeout(notifyLoaded, 100);
    }

    function onBgVideoLoadFail(err) {
        waitingOnBgVideoLoad = false;
        console.log("Retrying video load..", err);
        var bgVideoEl = $("#bgVideo");
        bgVideoEl[0].removeEventListener('timeupdate', onBgVideoLoad, false);
        bgVideoEl[0].removeEventListener('error', onBgVideoLoadFail, false);
        bgVideoEl[0].pause();
        bgVideoEl[0].src = ""; // empty source
        bgVideoEl[0].load();

        //Try again
        $timeout(function () {
            onModelUpdate();
            notifyLoaded();
        }, 1000);
    }

    function notifyLoaded() {
        if (waitingOnBgVideoLoad) {
            return;
        }
        $timeout(function () {
            if (!loaded) {
                $window.$cardApi.notifyOnLoad();
                loaded = true;
                // get store details and data
                $scope.loadingFlag = true;
                getStoreDetails();
            }
        }, 50);
    }

    // initialize the app
    init();
});