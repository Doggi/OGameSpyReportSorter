// ==UserScript==
// @name        OGame spy report sorter
// @namespace   ogame
// @include     http://*.ogame.gameforge.com/game/index.php?page=messages*
// @version     1.12
// @updateURL   https://github.com/Doggi/OGameSpyReportSorter/raw/master/OGameSpyReportSorter.user.js
// @downloadURL https://github.com/Doggi/OGameSpyReportSorter/raw/master/OGameSpyReportSorter.user.js
// @grant       none
// @author      Doggi
// ==/UserScript==

/** PLUGINS **/
// Wait for a element
(function ($) {

    /**
     * @function
     * @property {object} jQuery plugin which runs handler function once specified element is inserted into the DOM
     * @param {function} handler A function to execute at the time when the element is inserted
     * @param {bool} shouldRunHandlerOnce Optional: if true, handler is unbound after its first invocation
     * @example $(selector).waitUntilExists(function);
     */

    $.fn.waitUntilExists = function (handler, shouldRunHandlerOnce, isChild) {
        var found = 'found';
        var $this = $(this.selector);
        var $elements = $this.not(function () {
            return $(this).data(found);
        }).each(handler).data(found, true);

        if (!isChild) {
            (window.waitUntilExists_Intervals = window.waitUntilExists_Intervals || {})[this.selector] =
                window.setInterval(function () {
                    $this.waitUntilExists(handler, shouldRunHandlerOnce, true);
                }, 500);
        }
        else if (shouldRunHandlerOnce && $elements.length) {
            window.clearInterval(window.waitUntilExists_Intervals[this.selector]);
        }

        return $this;
    }

}(jQuery));

function parseOGameValues(value) {
    if (typeof value == "string") {
        if (value.indexOf(".") > 0) {
            return parseInt(value.replace(".", ""));
        } else if (value.indexOf(",") > 0) {
            return parseFloat(value.replace(",", ".")) * 1000000;
        } else {
            return parseInt(value);
        }
    }
    return value;
}

function getStorageItem(key){
    return localStorage.getItem(key);
}

function setStorageItem(key, value){
    localStorage.setItem(key, value);
}

function removeStorageItem(key){
    localStorage.removeItem(key);
}

function getSpyReportClick(name){
    return getStorageItem(name);
}

function renmoveSpyReportClick(name){
    removeStorageItem(name);
}

function setSpyReportClick(name, value){
    setStorageItem(name,value);
}

function oldSaveName2NewSaveName(name){
    return name.split("_");
}


Number.decPoint = ',';
Number.thousand_sep = '.';

Number.prototype.format = function (k, fixLength) {
    if (!k) k = 0;
    var neu = '';
    var sign = this < 0 ? '-' : '';

    // Runden
    var f = Math.pow(10, k);
    var zahl = Math.abs(this);
    zahl = '' + parseInt(zahl * f + .5) / f;

    // Komma ermittlen
    var idx = zahl.indexOf('.');
    // fehlende Nullen einfügen
    if (fixLength && k) {
        zahl += (idx == -1 ? '.' : '' )
            + f.toString().substring(1);
    }

    // Nachkommastellen ermittlen
    idx = zahl.indexOf('.');
    if (idx == -1) idx = zahl.length;
    else neu = Number.decPoint + zahl.substr(idx + 1, k);

    // Tausendertrennzeichen
    while (idx > 0) {
        if (idx - 3 > 0)
            neu = Number.thousand_sep + zahl.substring(idx - 3, idx) + neu;
        else
            neu = zahl.substring(0, idx) + neu;
        idx -= 3;
    }
    return sign + neu;
};


var left_menu_html = '<li><span class="menu_icon"><a id="spio_menubutton_logo" class="spio_menubutton_logo_inactive"></a></span><a id="spio_menubutton" class="menubutton" href=""><span class="textlabel">Spioreports</span><span id="spio_menubutton_coords"></span></a></li>';
var message_template = '<div class="compacting"><span class="ctn ctn4 tooltipLeft" title="0">{{left}}</span><span class="ctn ctn4 fright tooltipRight" title="">{{right}}</span></div>';
var message_template_link = '<a class="spioreports_direct_link" data-msg-id="{{msg_id}}" data-wave="{{welle}}" data-ress="{{ress}}" style="{{style}}" href="/game/index.php?page=fleet1&galaxy={{galaxy}}&system={{system}}&position={{position}}&type=1&mission=1&am{{schiff_type}}={{schiff_anzahl}}">{{text}}</a>';
var minBeute = 100000;
var kleineTransporterKapazitaet = 5000;
var kleineTransporterAM = 202;
var grosseTransporterKapazitaet = 25000;
var grosseTransporterAM = 203;
var storageNameClicks = "osrs_clicks";
var isExecuted = false;

(function () {
    var $ = window.jQuery;
    try {
        $ = unsafeWindow.jQuery;
    } catch (e) {
        console.error("no jquery detected");
    }

    //add menu
    $("ul#menuTableTools").append(left_menu_html);

    var messagesTabXPath = "div#ui-id-20 ul.tab_inner";
    var messageTabXPath = messagesTabXPath + " li.msg";

    console.log("starting OGameSpioReportSorter");

    if( getStorageItem(storageNameClicks) === undefined ){
        setStorageItem(storageNameClicks, {});
    }

    //alles was nach dem laden passieren soll
    $(messagesTabXPath + " ul.pagination").waitUntilExists(function () {
        if( !isExecuted ) {
            console.log("ready wait until");
            execute();
            isExecuted = true;
        } else {
            console.log("ready wait until, but its running");
        }
    });

    function execute(){
        var spios = new Array();
        $(messageTabXPath).each(function (index, value) {

            if ($(this).text().indexOf("Spionageaktion") < 0) {
                var type = "spionagebericht";
                var full_spio = $(this);
                var koordinaten = full_spio.text().match(/\[\d+:\d+:\d+\]/i)[0].replace("[", "").replace("]", "").split(":");
                var spio_compactings = $($(this).children("span.msg_content")).children("div.compacting");
                var rohstoffe = $(spio_compactings[1]).text().match(/Rohstoffe: (\d+.\d+|\d,\d{3}M|\d+)/i)[1];
                var beuteFactor = $(spio_compactings[2]).text().match(/Beute: (\d+)%/i)[1];
                var flotte = $(spio_compactings[3]).text().match(/Flotten: (\d+.\d+|\d,\d{3}M|\d+)/i)[1];
                var verteidigung = $(spio_compactings[3]).text().match(/Verteidigung: (\d+.\d+|\d,\d{3}M|\d+)/i)[1];
            } else {
                var koordinaten = [0, 0, 0];
                var type = "spionageaktion";
                var rohstoffe = 0;
                var beuteFactor = 0;
                var flotte = 0;
                var verteidigung = 0;
            }

            spios.push({
                element: this,
                msgId: $(this).data("msg-id"),
                type: type,
                rohstoffe: parseOGameValues(rohstoffe),
                beuteFactor: parseInt(beuteFactor) / 100,
                flotte: parseOGameValues(flotte),
                verteidigung: parseOGameValues(verteidigung),
                koordinaten: koordinaten,
                isSpionagebericht: function () {
                    return this.type == "spionagebericht";
                },
                beute: function (ress) {
                    if( ress === undefined ){
                        return Math.round(this.rohstoffe * this.beuteFactor);
                    } else {
                        return Math.round(ress * this.beuteFactor);
                    }

                },
                wertigkeit: function () {
                    endWhile = false;
                    preBeute = this.rohstoffe;
                    pb = 0;
                    for (i = 1; pb !== null; i++) {
                        pb = getSpyReportClick("spioreports_clicks_" + this.msgId + "_" + i + "_" + this.beute(preBeute));
                        if (pb !== null) {
                            preBeute -= pb;
                        }
                    }
                    preBeute = this.beute(preBeute);

                    if (!this.isSpionagebericht()) return Number.MAX_VALUE;
                    wertigkeit = 0;
                    wertigkeit += (preBeute < minBeute ? 0 : preBeute);
                    wertigkeit -= this.flotte;
                    wertigkeit -= this.verteidigung;
                    return wertigkeit;
                },
                waveStorage: null,
                waves: function(){
                    if (this.waveStorage !== null){
                        return this.waveStorage;
                    }
                    this.waveStorage = [];
                    rohstoffe = this.rohstoffe;
                    for (var i=1;this.beute(rohstoffe) > minBeute; i++){
                        this.waveStorage[i] = {
                            wave: i,
                            ressource: this.beute(rohstoffe)
                        };
                        rohstoffe = this.waveStorage[i].ressource;
                    }
                    return this.waveStorage;

                }
            });
        });

        spios.sort(function (a, b) {
            return b.wertigkeit() - a.wertigkeit();
        });

        $(messageTabXPath).remove();


        spios.forEach(function (element, index, array) {
            $(messagesTabXPath).append(element.element);
            if(!element.isSpionagebericht()){
                return false;
            }

            var beute = element.beute();
            var beute_gesamt = 0;
            var steps = 1;
            for (var i = 1; beute > minBeute; i++) {
                beute_gesamt += beute;
                var link_t = message_template_link
                    .replace(/{{galaxy}}/g, element.koordinaten[0])
                    .replace(/{{system}}/g, element.koordinaten[1])
                    .replace(/{{position}}/g, element.koordinaten[2])
                    .replace(/{{welle}}/g, i)
                    .replace(/{{msg_id}}/g, element.msgId)
                    .replace(/{{ress}}/g, beute);

                if (getSpyReportClick("spioreports_clicks_" + element.msgId + "_" + i + "_" + beute) === null) {
                    link_t = link_t.replace(/{{style}}/g, "color: green");
                } else {
                    link_t = link_t.replace(/{{style}}/g, "color: red");
                }

                var anzahl_klein = Math.ceil(beute / kleineTransporterKapazitaet);
                var anzahl_gross = Math.ceil(beute / grosseTransporterKapazitaet);

                $($(element.element).children("span.msg_content")).append(message_template
                    .replace(/{{left}}/g, "Welle " + i + ": Rohstoffe: " + beute.format())
                    .replace(/{{right}}/g,
                        link_t.replace(/{{schiff_type}}/g, kleineTransporterAM).replace(/{{schiff_anzahl}}/g, anzahl_klein).replace(/{{text}}/g, "kl.Trans: " + anzahl_klein) + " - " +
                        link_t.replace(/{{schiff_type}}/g, grosseTransporterAM).replace(/{{schiff_anzahl}}/g, anzahl_gross).replace(/{{text}}/g, "gr.Trans: " + anzahl_gross) +
                        ' | <a class="spioreports_direct_link_reset" href="" data-wave="' + i + '" data-msg-id="' + element.msgId + '" data-ress="' + beute + '">reset</a>'
                    ));

                beute -= Math.ceil(beute * element.beuteFactor);
            }

            beute_gesamt = beute_gesamt == 0 ? beute : beute_gesamt;

            $(
                $(element.element).children("span.msg_content")).append(
                message_template
                    .replace("{{left}}", "gesamte Rohstoffe: " + beute_gesamt.format() + " von " + element.rohstoffe.format() + " es verbleiben " + (element.rohstoffe - beute_gesamt).format())
                    .replace("{{right}}", "")
            );

        });

        $("a.spioreports_direct_link").click(function () {
            msg = $(this).data("msg-id");
            wave = $(this).data("wave");
            ress = $(this).data("ress");

            value = getSpyReportClick("spioreports_clicks_" + msg + "_" + wave + "_" + ress);

            if (value !== null) {
                return false;
            } else {
                setSpyReportClick("spioreports_clicks_" + msg + "_" + wave + "_" + ress, ress);
            }
        });

        $("a.spioreports_direct_link_reset").click(function () {
            msg = $(this).data("msg-id");
            wave = $(this).data("wave");
            ress = $(this).data("ress");
            renmoveSpyReportClick("spioreports_clicks_" + msg + "_" + wave + "_" + ress);
        });

    }
})();