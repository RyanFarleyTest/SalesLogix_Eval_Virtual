/*
 * SagePlatform
 * Copyright(c) 2009, Sage Software.
 */


window.Sage = window.Sage || {};
window.Sage.__namespace = true; //allows child namespaces to be registered via Type.registerNamespace(...)


Sage.namespace = function(ns) {
    if (!ns || !ns.length) {
        return null;
    }

    var levels = ns.split(".");
    var nsobj = Sage;

    // Sage is implied, so it is ignored if it is included
    for (var i=(levels[0] == "Sage") ? 1 : 0; i<levels.length; ++i) {
        nsobj[levels[i]] = nsobj[levels[i]] || {};
        nsobj = nsobj[levels[i]];
    }

    return nsobj;
};

Sage.createNamespace = function(ns) {
    if (!ns || !ns.length) {
        return null;
    }

    var levels = ns.split(".");
    window[levels[0]] = window[levels[0]] || {};
    var nsobj = window[levels[0]];

    // Sage is implied, so it is ignored if it is included
    for (var i=1; i<levels.length; ++i) {
        nsobj[levels[i]] = nsobj[levels[i]] || {};
        nsobj = nsobj[levels[i]];
    }

    return nsobj;
};

Sage.extend = function(subclass, superclass) {
    var f = function() {};
    f.prototype = superclass.prototype;
    subclass.prototype = new f();
    subclass.prototype.constructor = subclass;
    subclass.superclass = superclass.prototype;
    if (superclass.prototype.constructor == Object.prototype.constructor) {
        superclass.prototype.constructor = superclass;
    }
};

Sage.ServiceContainer = function(){
    _services = [];
};
Sage.ServiceContainer.prototype = {
    addService: function(name, service){
        if(name && service){
            if(!this.hasService(name)){
                var innerService = {};
                innerService.key = name;
                innerService.service = service;
                _services.push(innerService);
                return service;
            }
            else{
                throw "Service already exists: " + name;
            }
        }
    },
    removeService: function(name){
        for(i=0;i<_services.length;i++){
            if(_services[i].key === name){
                _services.splice(i, 1);
            }
        }
    },
    getService: function(name){
        if(name){
            for(i=0;i<_services.length;i++){
                if(_services[i].key === name)
                    return _services[i].service;
            }
        }
        return null;
    },
    hasService: function(name){
        if(name){
            for(i=0;i<_services.length;i++){
                if(_services[i].key === name)
                    return true;
            }
        }
        return false;
    }
}

Sage.Services = new Sage.ServiceContainer();
// class used for watching bound data fields and notifying the user that they have dirty data
ClientBindingManagerService = function() {
    this._WatchChanges = true;
    this._PageExitWarningMessage = "";
    this._ShowWarningOnPageExit = false;
    this._SkipCheck = false;
    this._CurrentEntityIsDirty = false;
    this._SaveBtnID = "";
    this._MsgDisplayID = "";
    this._entityTransactionID = "";
    
    positionDirtyDataMessage();
};

$(document).ready(function() {
    Sys.WebForms.PageRequestManager.getInstance().add_endRequest(positionDirtyDataMessage);
});

function positionDirtyDataMessage() {
    if ($('#PageTitle').get().length > 0) {
        $('#PageTitle').after($('.dirtyDataMessage').replaceWith(''))
        $('.dirtyDataMessage').css('top', $('#PageTitle').position().top);
        $('.dirtyDataMessage').css('left', $('#PageTitle').outerWidth());
    }
}

ClientBindingManagerService.prototype.SetShowWarningOnPageExit = function(showMsg) {
    this._ShowWarningOnPageExit = (showMsg);
    if (this._ShowWarningOnPageExit) {
        window.onbeforeunload = this.onExit;
    }
};

ClientBindingManagerService.prototype.onExit = function(e) {
    var mgr = Sage.Services.getService("ClientBindingManagerService");
    if (mgr) {
        if (mgr._ShowWarningOnPageExit) {
            if (mgr._SkipCheck) {
                //_SkipCheck = false;
                return;
            }
            if (mgr._CurrentEntityIsDirty) {
                window.setTimeout(function() {
                    hideRequestIndicator(null, { });
                }, 1000);
                if (window.event) {
                    window.event.returnValue = mgr._PageExitWarningMessage;
                } else {
                    return mgr._PageExitWarningMessage;
                }
            }
        }
    }
    return;
};


ClientBindingManagerService.prototype.canChangeEntityContext = function() {
    if ((this._WatchChanges) && (this._CurrentEntityIsDirty) && (this._ShowWarningOnPageExit)) {
        if (confirm(this._PageExitWarningMessage)) {
            this.clearDirtyStatus();
            return true;
        } else {
            return false;
        }
    }
    return true;
};

ClientBindingManagerService.prototype.markDirty = function(e) {
    var mgr = Sage.Services.getService("ClientBindingManagerService");
    if (mgr) {
        if (mgr._WatchChanges) {
            mgr._CurrentEntityIsDirty = true;
            positionDirtyDataMessage();
            $("#" + mgr._MsgDisplayID).show();
        }
    }
};

ClientBindingManagerService.prototype.clearDirtyStatus = function() {
    var mgr = Sage.Services.getService("ClientBindingManagerService");
    if (mgr) {
        mgr._CurrentEntityIsDirty = false;
        $("#" + mgr._MsgDisplayID).hide();
    }
};

function notifyIsSaving() {
    Sys.WebForms.PageRequestManager.getInstance().add_endRequest(handleEndSaveRequest);
    var mgr = Sage.Services.getService("ClientBindingManagerService");
    if (mgr) {
        mgr.clearDirtyStatus();
    }
};

function handleEndSaveRequest(sender, args) {
    var mgr = Sage.Services.getService("ClientBindingManagerService");
    if (mgr) {
        if (!args.get_error()) {
            mgr.clearDirtyStatus();
        } else {
            mgr.markDirty();
        }
        Sys.WebForms.PageRequestManager.getInstance().remove_endRequest(handleEndSaveRequest);
    }
};

ClientBindingManagerService.prototype.saveForm = function() {
    var btn = $get(this._SaveBtnID);
    if (btn) {
        if ((btn.tagName.toLowerCase() == "input") && (btn.type == "image")) {
            notifyIsSaving();
            Sys.WebForms.PageRequestManager.getInstance()._doPostBack(btn.name, null);
        } else if (btn.onClick) {
            notifyIsSaving();
            btn.onClick();
        }
    }
};

ClientBindingManagerService.prototype.registerResetBtn = function(elemID) {
    if (elemID) {
        var btn = $get(elemID);
        if (btn) {
            $addHandler(btn, "click", this.resetCurrentEntity);
        }
    }
};

ClientBindingManagerService.prototype.registerSaveBtn = function(elemID) {
    if (elemID) {
        var btn = $get(elemID);
        if (btn) {
            $addHandler(btn, "click", notifyIsSaving);
            if (this._SaveBtnID == "") {
                this._SaveBtnID = elemID;
            }
        }
    }
};

ClientBindingManagerService.prototype.registerDialogCancelBtn = function(elemID) {
    if (elemID) {
        var btn = $get(elemID);
        if (btn) {
            $addHandler(btn, "click", this.rollbackCurrentTransaction);
        }
    }
};

ClientBindingManagerService.prototype.registerBoundControls = function(controlList) {
    var mgr = Sage.Services.getService("ClientBindingManagerService");
    if (mgr) {
        if ((mgr._WatchChanges) && (controlList)) {
            var ctrlIDs = controlList.split(",");
            var elem;
            for (var i = 0; i < ctrlIDs.length; i++) {
                elem = $get(ctrlIDs[i]);
                if (elem) {
                    // check here for attribute saying it is a container - if it is, recurse children looking for the correct one(s)...
                    if (elem.attributes["slxcompositecontrol"]) {
                        mgr.findChildControls(elem);
                    } else {
                        mgr.attachChangeHandler(elem);
                    }
                    //if (mgr._ShowWarningOnPageExit) {
                    //    mgr.registerPostBackWarningExceptions(elem);  //if this is a control that contains a link we want to allow it to do its thing without prompting the user
                    //}
                }
            }
        }
        mgr.findWarningExceptions();
    }
};

ClientBindingManagerService.prototype.findChildControls = function(elem) {
    if ((elem) && (elem.attributes) && (elem.attributes["slxchangehook"]) && (!elem.attributes["slxcompositecontrol"])) {
        //alert("found a changehook: \nID: " + elem.id + "\nname: " + elem.name + "\nelem: " + elem);
        this.attachChangeHandler(elem);
    } else {
        if (elem.childNodes) {
            for (var n = 0; n < elem.childNodes.length; n++) {
                this.findChildControls(elem.childNodes[n]);
            }
        }
    }
};

ClientBindingManagerService.prototype.setControlFocus = function(ctrlid) {
    trySelect = function(elem) {
        if ((typeof (elem.select) == "function") || (typeof (elem.select) == "object")) {
            elem.select();
            return true;
        }
        return false;
    };
    var elem = $("#" + ctrlid)[0];
    if (elem) {
        if (trySelect(elem)) { return; }
        elem = $("#" + ctrlid + " TEXTAREA")[0];
        if ((elem) && (trySelect(elem))) { return; }
        elem = $("#" + ctrlid + " INPUT")[0];
        if ((elem) && (trySelect(elem))) { return; }
        elem = $("#" + ctrlid + " SELECT")[0];
        if ((elem) && (trySelect(elem))) { return; }
    }
};

ClientBindingManagerService.prototype.attachChangeHandler = function(elem) {
    if (elem) {
        if ((elem.tagName == "A") || ((elem.tagName == "INPUT") && ((elem.type == "button") || (elem.type == "image") || (elem.type == "submit")))) {
            this.registerChildPostBackWarningExceptions(elem);
        } else {
            try { $removeHandler(elem, "change", this.markDirty); } catch (e) { }
            $addHandler(elem, "change", this.markDirty);
        }
    }
};

ClientBindingManagerService.prototype.registerPostBackWarningExceptions = function(elem) {
    if (elem) {
        elems = $("a,input[type='INPUT'],input[type='BUTTON'],input[type='IMAGE'],input[type='SUBMIT']", elem).get();
        for(var i = 0; i < elems.length; i++) {
            this.registerChildPostBackWarningExceptions(elems[i]);
        }
    }
}
ClientBindingManagerService.prototype.findWarningExceptions = function() {
    var elems = $("span[slxcompositecontrol], div[slxcompositecontrol]").get();
    for(var i = 0; i < elems.length; i++) {
        this.registerPostBackWarningExceptions(elems[i]);
    }
}

ClientBindingManagerService.prototype.registerChildPostBackWarningExceptions = function(elem) {
    if (elem) {
        if ($(elem).hasClass("leavesPage")) {
            return;
        }
        if ((elem.tagName == "A") || ((elem.tagName == "INPUT") && ((elem.type == "button") || (elem.type == "image") || (elem.type == "submit")))) {
            try { $removeHandler(elem, "click", this.skipWarning); } catch (e) { }
            $addHandler(elem, "click", this.skipWarning);
        }
    }
};

ClientBindingManagerService.prototype.turnOffWarnings = function() {
    var mgr = Sage.Services.getService("ClientBindingManagerService");
    if (mgr) {
        mgr._SkipCheck = true;
        var x = window.setTimeout(function() {var mgr = Sage.Services.getService("ClientBindingManagerService"); if (mgr) { mgr._SkipCheck = true }}, 500);  //just in case there is a timer waiting to turn it back on
    }
};

ClientBindingManagerService.prototype.resumeWarning = function() {
    var mgr = Sage.Services.getService("ClientBindingManagerService");
    if (mgr) {
        mgr._SkipCheck = false;
    }
};

ClientBindingManagerService.prototype.skipWarning = function() {
    var mgr = Sage.Services.getService("ClientBindingManagerService");
    if (mgr) {
        mgr._SkipCheck = true;
        var x = window.setTimeout(function() {var mgr = Sage.Services.getService("ClientBindingManagerService"); if (mgr) { mgr._SkipCheck = false }}, 500);
    }
};

ClientBindingManagerService.prototype.resetCurrentEntity = function() {
    doFormReset();
    var mgr = Sage.Services.getService("ClientBindingManagerService");
    if (mgr) {
        var contextservice = Sage.Services.getService("ClientContextService");
        if (contextservice) {
            if (contextservice.containsKey("ResetCurrentEntity")) {
                contextservice.setValue("ResetCurrentEntity", "true");
            } else {
                contextservice.add("ResetCurrentEntity", "true");
            }
        }
        mgr.clearDirtyStatus();
    }
};

ClientBindingManagerService.prototype.rollbackCurrentTransaction = function() {
    doSectionReset("dialog");
    var mgr = Sage.Services.getService("ClientBindingManagerService");
    if (mgr) {
        //alert("rolling back current transaction... " + mgr._entityTransactionID);
        var contextservice = Sage.Services.getService("ClientContextService");
        if (contextservice) {
            if (contextservice.containsKey("RollbackEntityTransaction")) {
                contextservice.setValue("RollbackEntityTransaction", mgr._entityTransactionID);
            } else {
                contextservice.add("RollbackEntityTransaction", mgr._entityTransactionID);
            }
        }
    }
};

function doFormReset() {
    if (document.all) {
        doSectionReset("main");
        doSectionReset("tabs");
        doSectionReset("dialog");
    } else {
        document.forms[0].reset();
    }
};

function doSectionReset(sectionId) {
    function getElements(sectionId, tagName) {
        if ((sectionId == "main") && (document.all.MainContent)) {
            return document.all.MainContent.getElementsByTagName(tagName);
        } else if ((sectionId == "tabs") && (document.all.ctl00_TabControl)) {
            return document.all.ctl00_TabControl.getElementsByTagName(tagName);
        } else if (document.all.ctl00_DialogWorkspace) {
            return document.all.ctl00_DialogWorkspace.getElementsByTagName(tagName);
        } 
        return new Array();
    }
    if (document.all) {
        var elem;
        var elems = getElements(sectionId, "INPUT");
        for (var i = 0; i < elems.length; i++) {
            elem = elems[i];
            if ((elem.type == "checkbox") || (elem.type == "radio")) {
                if (elem.checked != elem.defaultChecked) {
                    elem.checked = elem.defaultChecked;
                }
            } else {
                if (elem.value != elem.defaultValue) {
                    elem.value = elem.defaultValue;
                }
            }
        }
        elems = getElements(sectionId, "TEXTAREA");
        for (var i = 0; i < elems.length; i++) {
            elem = elems[i];
            if (elem.value != elem.defaultValue) {
                elem.value = elem.defaultValue;
            }
        }
        elems = getElements(sectionId, "SELECT");
        for (var i = 0; i < elems.length; i++) {
            elem = elems[i];
            for (var k = 0; k < elem.options.length; k++) {
                elem.options[k].selected = elem.options[k].defaultSelected;
            }
        }
    } else {
        document.forms[0].reset();
    }
};

//var mgr = Sage.Services.getService("ClientBindingManagerService");
//if (mgr) { mgr.rollbackCurrentTransaction(); }

ClientBindingManagerService.prototype.setCurrentTransaction = function(transaction) {
    this._entityTransactionID = transaction;
};

function clearReset() {
    //alert("clearing reset");
    if (Sage.Services) {
        var contextservice = Sage.Services.getService("ClientContextService");
        if (contextservice) {
            if (contextservice.containsKey("ResetCurrentEntity")) {
                contextservice.remove("ResetCurrentEntity");
            }
            if (contextservice.containsKey("RollbackEntityTransaction")) {
                contextservice.remove("RollbackEntityTransaction");
                //alert(contextservice.containsKey("RollbackEntityTransaction"));
            }
        }
    }
};

Sage.Services.addService("ClientBindingManagerService", new ClientBindingManagerService());

Sage.ClientContextService = function(contextDataFieldId){
    this.contextDataFieldId = contextDataFieldId;
    _items = [];
    _watches = [];
    
    //Internal Helper Methods
    _toItemLiteral = function(key, value){
        var newItem = {};
        newItem.itemKey = key;
        newItem.itemVal = value;
        return newItem;
    };
    _indexOf = function(key){
        for(i=0;i<_items.length;i++){
            if(_items[i].itemKey == key){
                return i;
            }
        }
        return -1;
    };
    
    _throwKeyNotFound = function(key){
        throw "Entry Not Found: " + key;
    };
    _throwDuplicateKey = function(key){
        throw "Entry Already Exists: " + key;
    }
    this.load();
}
Sage.ClientContextService.prototype = {
    add: function(key, value){
        if(_indexOf(key) === -1){
            var lit = _toItemLiteral(key, value);
            _items.push(lit);
            this.save();
        }
        else
            _throwDuplicateKey(key);
    },
    remove: function(key){
        var index = _indexOf(key);
        if(index !== -1){
            _items.splice(index, 1);
            this.save();
        }
    },
    setValue: function(key, value){
        var index = _indexOf(key);
        if(index !== -1){
            _items[index].itemVal = value;
            this.save();
        }  
        else{
            _throwKeyNotFound(key);
        }
    },
    getValue: function(key){
        var index = _indexOf(key);
        //alert(index);
        if(index !== -1){
            return _items[index].itemVal;
        }
        else{
            _throwKeyNotFound(key);
        }
    },
    clear: function(){
        _items = [];
        this.save();
    },
    containsKey: function(key){
        return (_indexOf(key) !== -1);
    },
    getCount: function(){
      return _items.length;
    },
    hasKeys: function(){
        return _items.length === 0;
    },
    getKeys: function(){
        var keyRes = [];
        for(i=0;i<_items.length;i++){
            keyRes.push(_items[i].itemKey);
        }
        return keyRes;
    },
    valueAt: function(index){
        if(_items[index]){
            return _items[index].itemVal;
        }
        else{
            return null;
        }
    },
    keyAt: function(index){
        this.load();
        if(_items[index])
            return _items[index].itemKey;   
        else
            return null;
    },
    getValues: function(){
        var valRes = [];
        for(i=0;i<_items.length;i++){
            valRes.push(_items[i].itemVal);
        }
        return valRes;
    },
    save: function(hours){
        var data = document.getElementById(this.contextDataFieldId);
        if(data){
            //alert("saving to: " + data.id);
            data.value = this.toString();
        }
        else{
            alert("can't find context data field");
        }
    },
    load: function(){
        var data = document.getElementById(this.contextDataFieldId);
        if(data){
            if(data.value){
                //alert("loading from: " + data.id);
                this.fromString(data.value);
            }
        }
        else{
            alert("can't find context data field");
        }
    },
    toString: function(){
        var str = "";
        for(i=0;i<_items.length;i++){
            str += _items[i].itemKey + "=" + escape(_items[i].itemVal);
            if(i !== _items.length - 1)
                str += "&";
        }
        return str;
    },
    fromString: function(qString){
        _items = [];
        if(qString != ""){
            var items = qString.split("&");
            for(i=0;i<items.length;i++){
                var pair = items[i].split("=");
                _items.push(_toItemLiteral(pair[0], unescape(pair[1])));
            }
        }
        this.save();
    }
}

//Sage.Services.addService("ClientContextService", new Sage.ClientContextService());


Sage.ClientEntityContextService = function() {
	this.emptyContext = { "EntityId" : "", "EntityType" : "", "Description" : "", "EntityTableName" : "" };
}

Sage.ClientEntityContextService.prototype.getContext = function() {
	var dataelem = $get("__EntityContext");
	if (dataelem) {
		if (dataelem.value != "") {
			return eval(dataelem.value);
		}
	}
	return this.emptyContext;
}

Sage.Services.addService("ClientEntityContext", new Sage.ClientEntityContextService());
Sage.WebClientMessageService = function(options) {
   
};

Sage.WebClientMessageService.prototype.hideClientMessage = function() {	
	Ext.Msg.hide();
};

Sage.WebClientMessageService.prototype.showClientMessage = function(title, msg, fn, scope) { 
	if (typeof title === "object")
	    return Ext.Msg.alert(title);	    	
	
	var o = {
	    title: (typeof msg === "string") ? title : Sage.WebClientMessageService.Resources.DefaultDialogMessageTitle,
	    msg: (typeof msg === "string") ? msg : title,
	    buttons: Ext.Msg.OK,
	    fn: fn,
	    scope: scope
	};
	
    Ext.Msg.show(o);	
};

Sage.Services.addService("WebClientMessageService", new Sage.WebClientMessageService());



Ext.ux.Portal = Ext.extend(Ext.Panel, {
    layout: 'column',
    autoScroll:true,
    cls:'x-portal',
    defaultType: 'portalcolumn',

    initComponent : function(){
        Ext.ux.Portal.superclass.initComponent.call(this);
        this.addEvents({
            validatedrop:true,
            beforedragover:true,
            dragover:true,
            beforedrop:true,
            drop:true
        });
    },

    initEvents : function(){
        Ext.ux.Portal.superclass.initEvents.call(this);
        this.dd = new Ext.ux.Portal.DropZone(this, this.dropConfig);
    }
});
Ext.reg('portal', Ext.ux.Portal);


Ext.ux.Portal.DropZone = function(portal, cfg){
    this.portal = portal;
    Ext.dd.ScrollManager.register(portal.body);
    Ext.ux.Portal.DropZone.superclass.constructor.call(this, portal.bwrap.dom, cfg);
    portal.body.ddScrollConfig = this.ddScrollConfig;
};

Ext.extend(Ext.ux.Portal.DropZone, Ext.dd.DropTarget, {
    ddScrollConfig : {
        vthresh: 50,
        hthresh: -1,
        animate: true,
        increment: 200
    },

    createEvent : function(dd, e, data, col, c, pos){
        return {
            portal: this.portal,
            panel: data.panel,
            columnIndex: col,
            column: c,
            position: pos,
            data: data,
            source: dd,
            rawEvent: e,
            status: this.dropAllowed
        };
    },

    notifyOver : function(dd, e, data){
        var xy = e.getXY(), portal = this.portal, px = dd.proxy;

        // case column widths
        if(!this.grid){
            this.grid = this.getGrid();
        }

        // handle case scroll where scrollbars appear during drag
        var cw = portal.body.dom.clientWidth;
        if(!this.lastCW){
            this.lastCW = cw;
        }else if(this.lastCW != cw){
            this.lastCW = cw;
            portal.doLayout();
            this.grid = this.getGrid();
        }

        // determine column
        var col = 0, xs = this.grid.columnX, cmatch = false;
        for(var len = xs.length; col < len; col++){
            if(xy[0] < (xs[col].x + xs[col].w)){
                cmatch = true;
                break;
            }
        }
        // no match, fix last index
        if(!cmatch){
            col--;
        }

        // find insert position
        var p, match = false, pos = 0,
            c = portal.items.itemAt(col),
            items = c.items.items;

        for(var len = items.length; pos < len; pos++){
            p = items[pos];
            var h = p.el.getHeight();
            if(h !== 0 && (p.el.getY()+(h/2)) > xy[1]){
                match = true;
                break;
            }
        }

        var overEvent = this.createEvent(dd, e, data, col, c,
                match && p ? pos : c.items.getCount());

        if(portal.fireEvent('validatedrop', overEvent) !== false &&
           portal.fireEvent('beforedragover', overEvent) !== false){

            // make sure proxy width is fluid
            px.getProxy().setWidth('auto');

            if(p){
                px.moveProxy(p.el.dom.parentNode, match ? p.el.dom : null);
            }else{
                px.moveProxy(c.el.dom, null);
            }

            this.lastPos = {c: c, col: col, p: match && p ? pos : false};
            this.scrollPos = portal.body.getScroll();

            portal.fireEvent('dragover', overEvent);

            return overEvent.status;;
        }else{
            return overEvent.status;
        }

    },

    notifyOut : function(){
        delete this.grid;
    },

    notifyDrop : function(dd, e, data){
        delete this.grid;
        if(!this.lastPos){
            return;
        }
        var c = this.lastPos.c, col = this.lastPos.col, pos = this.lastPos.p;

        var dropEvent = this.createEvent(dd, e, data, col, c,
                pos !== false ? pos : c.items.getCount());

        if(this.portal.fireEvent('validatedrop', dropEvent) !== false &&
           this.portal.fireEvent('beforedrop', dropEvent) !== false){

            dd.proxy.getProxy().remove();
            dd.panel.el.dom.parentNode.removeChild(dd.panel.el.dom);
            if(pos !== false){
                c.insert(pos, dd.panel);
            }else{
                c.add(dd.panel);
            }
            
            c.doLayout();

            this.portal.fireEvent('drop', dropEvent);

            // scroll position is lost on drop, fix it
            var st = this.scrollPos.top;
            if(st){
                var d = this.portal.body.dom;
                setTimeout(function(){
                    d.scrollTop = st;
                }, 10);
            }

        }
        delete this.lastPos;
        slxDashboard.saveState();
    },

    // internal cache of body and column coords
    getGrid : function(){
        var box = this.portal.bwrap.getBox();
        box.columnX = [];
        this.portal.items.each(function(c){
             box.columnX.push({x: c.el.getX(), w: c.el.getWidth()});
        });
        return box;
    }
});

Ext.ux.PortalColumn = Ext.extend(Ext.Container, {
    layout: 'anchor',
    autoEl: 'div',
    defaultType: 'portlet',
    cls:'x-portal-column'
});
Ext.reg('portalcolumn', Ext.ux.PortalColumn);

Ext.ux.Portlet = Ext.extend(Ext.Panel, {
    anchor: '100%',
    frame:true,
    collapsible:true,
    draggable:true,
    cls:'x-portlet'
});
Ext.reg('portlet', Ext.ux.Portlet);

//Ext.onReady(function() {
function setupPortal() {    
    Ext.get("MainWorkArea").setStyle("display", "none");

    $.ajax({
        type: "POST",
        contentType: "application/json; charset=utf-8",
        url: "UIStateService.asmx/GetUIState",
        data: Ext.util.JSON.encode({
            section: "Dashboard",
            key: "PortalConfig_" + document.forms[0].action.substring(document.forms[0].action.lastIndexOf('/') + 1)
        }),
        dataType: "json",
        error: function (request, status, error) { 
            window.setTimeout(function() { doSetupPortal() }, 100);           
        },
        success: function(data, status) {  
            var resoptions;
            if (data && data.d) resoptions = Ext.util.JSON.decode(data.d);
            
            try 
            {                
                if (resoptions && !isNaN(resoptions.defportal)) 
                    userDashboardOptions = resoptions;                
            } 
            catch (ex) { }
            
            window.setTimeout(function() { doSetupPortal() }, 100);
        }
    }); 

    Ext.QuickTips.init();
};

function doSetupPortal() {
    for (var i = 0; i < userDashboardOptions.items.length; i++) {
        if (userDashboardOptions.items[i].name == 'My Workspace') {
            userDashboardOptions.items[i].name = DashboardResource.My_Workspace;
        }
    }
    slxDashboard = new Sage.SalesLogix.Dashboard(userDashboardOptions);
    slxDashboard.init();
}

function refreshPortletData(name) {
    var code = String.format("if (typeof {0} != 'undefined') {0}();", name + "_refresh");
    eval(code);
}


if (typeof Sys !== "undefined")
{
    Type.registerNamespace("Sage.SalesLogix");
}
else
{
    Ext.namespace("Sage.SalesLogix");
}


Sage.SalesLogix.Dashboard = function(options) {
    this._options = options;
    this._removed = {};
}

Sage.SalesLogix.Dashboard.prototype.createColumnObject = function(width) {
    return { columnWidth: width,
             style:'padding:10px 0px 10px 10px',
             items:[]};
}

Sage.SalesLogix.Dashboard.prototype.createTitle = function(name, number) {
    return String.format("{0} <img src='{1}' id='{3}' onclick='slxDashboard.createTabContextMenu({2}).show(Ext.get(\"{3}\"));'/>", 
        name, "images/expanddark.gif", number, "tab_icon_"+number);
}

Sage.SalesLogix.Dashboard.prototype.createCellObject = function(name, portalNum, column) {
    var curDashboard = this;
    return { 
        id : [name].join() + "_display", //add display or dup div ids that confuse the code later
        stateful: false,
        title: Ext.get(name).dom.title,
        tools: [
            {id: 'refresh',
            handler: function(e, target, panel) {
                    refreshPortletData(name);
                },
            qtip: DashboardResource.Refresh
            },
            {id: 'close',
            qtip: DashboardResource.Close,
            handler: function(e, target, panel){
                curDashboard._removed[panel.contentEl] = panel;
                
                panel.ownerCt.remove(panel, false);
                panel.hide();
                
                var cells = curDashboard._options.items[panel.location.dashboard].cells;
                for (var i=0; i < cells.length; i++) 
                    cells[i].remove(panel.location.cellitem);                
                
                
                curDashboard.saveState();
            }}
        ],
        collapsible: false,
        style:'padding:0px 0px 10px 0px', 
        location: { dashboard: portalNum, cellitem: name},
        html: Ext.get(name+"contents").dom.innerHTML //if we don't copy the html then we can't revert
    };
}

Sage.SalesLogix.Dashboard.prototype.init = function() {
    var portals = new Array();
    for (var k=0; k<this._options.items.length; k++) {
        var dashboardPortal = { xtype:'portal', 
            region:'center', 
            margins:'35 5 5 0', 
            border: false, 
            visible: true, 
            id: "portal_panel_"+k, 
            items:[], 
            title: this.createTitle(this._options.items[k].name, k)
        };
        for (var i=0; i<this._options.items[k].layout.length; i++) {
            dashboardPortal.items.push(this.createColumnObject(this._options.items[k].layout[i]));
            for (var j=0; j<this._options.items[k].cells[i].length; j++) {
                if (Ext.get(this._options.items[k].cells[i][j]) != null) {
                    dashboardPortal.items[i].items.push(this.createCellObject(this._options.items[k].cells[i][j], k, i));
                    var code = String.format("if (typeof {0} != 'undefined') {0}();", this._options.items[k].cells[i][j] + "_refresh");
                    eval(code);
                }
            }
        }
        portals.push(dashboardPortal);
    }
    var curDashboard = this;
    var centerpanel = mainViewport.findById("center_panel_center");
    var panel = this._tabPanel = new Ext.TabPanel({
        border: false, 
        enableTabScroll: true, 
        id: "dashboard_panel"
    });
    var hiddenPanels = new Array();
    for (var i=0; i<portals.length;i++) {
        var thisportal = panel.add(portals[i]);
        thisportal.on("drop", function (args) {
            var portalNum = args.portal.id.match(/\d+$/);
            var smartpart = args.panel.location.cellitem;
            var cells = curDashboard._options.items[portalNum].cells;
            for (var i=0; i<cells.length; i++) {
                cells[i].remove(smartpart);
            }
            cells[args.columnIndex].splice(args.position, 0, smartpart);
        });
        if (curDashboard._options.items[i].isHidden) {
            hiddenPanels.push(thisportal.id);
        }
    }
    panel.on("contextmenu", function (tabpanel, tab, e){
        var portalNum = parseInt(tab.id.match(/\d+$/), 10);
        curDashboard.createTabContextMenu(portalNum).showAt(e.getXY());
    });
    centerpanel.add(panel);
    mainViewport.doLayout();
    panel.activate("portal_panel_"+this._options.defportal);
    for (var i=0; i<hiddenPanels.length; i++) {
        panel.hideTabStripItem(hiddenPanels[i]);
    }
    panel.doLayout();
    if (typeof idRefreshAndCloseButtons != "undefined") {
        idRefreshAndCloseButtons();
    }
}

Sage.SalesLogix.Dashboard.prototype.getAvailableContent = function(portalNum) {
    var used = {};
    //for (var i = 0; i < dashboardAvailableContent.length; i++)
    //    used[dashboardAvailableContent[i]] = false;
        
    for (var i = 0; i < this._options.items.length; i++) 
        for (var j = 0; j < this._options.items[i].cells.length; j++) 
            for (var k = 0; k < this._options.items[i].cells[j].length; k++) 
                used[this._options.items[i].cells[j][k]] = true;
    
    var result = [];            
    for (var i = 0; i < dashboardAvailableContent.length; i++)
        if (used[dashboardAvailableContent[i]] !== true)
            result.push(dashboardAvailableContent[i]);
            
    return result;
        
    
}

Sage.SalesLogix.Dashboard.prototype.createTabContextMenu = function(portalNum) {
    var curDashboard = this;
    var origOptions = Sys.Serialization.JavaScriptSerializer.deserialize(
        Sys.Serialization.JavaScriptSerializer.serialize(this._options));
    var tcmenu = new Ext.menu.Menu({ items: [
        new Ext.menu.Item({ 
            text: DashboardResource.Add_Tab,
            icon: false,
            handler: function() {
                Ext.Msg.prompt(DashboardResource.Name, String.format('{0}:', DashboardResource.Name), function(btn, text){
                    if (btn == 'ok'){
                        curDashboard.newPortal(text);
                    }
                });                    
            }
        }),
        new Ext.menu.Item({ text: DashboardResource.Add_Content, handler: function() {
            var win = new Ext.Window({ title: DashboardResource.Add_New_Content,
                width: parseInt(DashboardResource.Popup_Width),
                height: parseInt(DashboardResource.Popup_Height),
                autoScroll: true,
                buttons: [{ text: DashboardResource.Ok, handler: function(t, e) { curDashboard.saveState(); t.ownerCt.close(); } }
                    , { text: DashboardResource.Cancel, handler: function(t, e) {
                        Ext.destroy(slxDashboard);
                        slxDashboard = new Sage.SalesLogix.Dashboard(origOptions);
                        slxDashboard.init();
                        t.ownerCt.close();
                    } 
                    }
                ]
            });
            var content = curDashboard.getAvailableContent(portalNum);
            if (content.length == 0) {
                win.add(new Ext.Panel({ html: String.format("<p>{0}</p>", DashboardResource.NoUnusedContent) }));
            }
            for (var i = 0; i < content.length; i++) {
                win.add(new Ext.form.Checkbox({ boxLabel: Ext.get(content[i]).dom.title,
                    contentId: content[i]
                })).on("check", function(t, checked) {
                    if (checked) {
                        var cell = curDashboard._removed[t.contentId];
                        if (cell) 
                        {
                            cell.location.dashboar = portalNum;
                            delete curDashboard._removed[t.contentId];  
                        }
                        else
                        {
                            cell = curDashboard.createCellObject(t.contentId, portalNum, 0);
                        }
                        
                        mainViewport.findById("portal_panel_" + portalNum).items.items[0].add(cell);
                                                    
                        
                        mainViewport.findById("center_panel_center").doLayout();
                        curDashboard._options.items[portalNum].cells[0].push(t.contentId);
                        var code = String.format("if (typeof {0} != 'undefined') {0}();", t.contentId + "_refresh");
                        eval(code);
                        t.el.dom.disabled = true;
                        t.el.dom.parentNode.style.display = "none";
                        t.el.dom.parentNode.nextSibling.style.display = "none";
                    }
                });
                var desc = $("#" + content[i] + "contents .portlet_description");
                if (desc.length > 0) {
                    win.add(new Ext.form.Label({ html: desc[0].innerHTML, style: "margin: 3px 10px 15px;display: block" }));
                } else {
                    win.add(new Ext.form.Label({ html: "&nbsp;", style: "margin: 3px 10px 15px;display: block" }));
                }
            }
            if (typeof idPopupWindow != "undefined") {
                win.on("show", function() { idPopupWindow(); });
            }
            win.show();
        } 
        }),
        new Ext.menu.Item({ text: DashboardResource.Edit_Options, handler: function() {
            var opWin = new Ext.Window({ title: DashboardResource.Edit_Options,
                width: parseInt(DashboardResource.Popup_Width),
                height: parseInt(DashboardResource.Popup_Height),
                buttons:
                    [{ text: DashboardResource.Ok, handler: function(t, e) {
                        if ($("#PortalName")[0].value.length > 0) {
                            var newTitle = Ext.util.Format.htmlEncode($("#PortalName")[0].value);
                            curDashboard._options.items[portalNum].name = newTitle;
                            mainViewport.findById("portal_panel_" + portalNum).setTitle(curDashboard.createTitle(newTitle, portalNum));
                        }
                        curDashboard.saveState();
                        var dp = mainViewport.findById("dashboard_panel");
                        dp.setWidth(dp.getSize().width - 1); //firing resize without changing anything doesn't recalc
                        dp.setWidth(dp.getSize().width + 1);
                        t.ownerCt.close();
                    }
                    }
                    , { text: DashboardResource.Cancel, handler: function(t, e) {
                        Ext.destroy(slxDashboard);
                        slxDashboard = new Sage.SalesLogix.Dashboard(origOptions);
                        slxDashboard.init();
                        t.ownerCt.close();
                    }
                    }
                ]
            });
            opWin.add(new Ext.Panel({
                html: String.format("<div style='margin: 5px 1px'>{0}: <input type='text' id='PortalName' value='{1}' /></div>",
                    DashboardResource.Name, curDashboard._options.items[portalNum].name)
                , border: false
            }));
            //            opWin.add(new Ext.form.Checkbox({boxLabel: DashboardResource.MakeThisMyDefault, 
            //                        checked: (parseInt(curDashboard._options.defportal) == parseInt(portalNum))
            //                    })).on("check", function(t,checked){ 
            //                        if (checked) {
            //                            curDashboard._options.defportal = portalNum;
            //                        } 
            //                    });
            opWin.add(new Ext.Panel({
                html: String.format("<div style='margin: 5px 1px'>{0}:</div>", DashboardResource.ChooseTemplate)
                , border: false
            }));

            var layouts = [
               { name: DashboardResource.TwoColSplit, layout: [.5, .5], imgUrl: 'images/icons/2col.gif' },
               { name: DashboardResource.ThreeCol, layout: [.33, .33, .34], imgUrl: 'images/icons/3col.gif' },
               { name: DashboardResource.TwoColLeft, layout: [.66, .34], imgUrl: 'images/icons/2col_bigL.gif' },
               { name: DashboardResource.TwoColRight, layout: [.34, .66], imgUrl: 'images/icons/2col_bigR.gif' },
               { name: DashboardResource.OneCol, layout: [.99], imgUrl: 'images/icons/1col.gif' }
            ];
            for (var i = 0; i < layouts.length; i++) {
                opWin.add(new Ext.form.Radio({ boxLabel: String.format("<img src='{1}'> {0}", layouts[i].name, layouts[i].imgUrl),
                    name: "Layout",
                    id: String.format("layout_{0}_id", i),
                    layout: layouts[i].layout,
                    style: "margin: 5px 5px",
                    checked: (layouts[i].layout[0] == curDashboard._options.items[portalNum].layout[0])
                })).on("check", function(t, checked) {
                    if (checked) {
                        var curPortal = mainViewport.findById("portal_panel_" + portalNum).items;
                        curDashboard._options.items[portalNum].layout = t.layout;
                        while (curDashboard._options.items[portalNum].cells.length < t.layout.length) {
                            curDashboard._options.items[portalNum].cells.push(new Array());
                        }
                        while (curDashboard._options.items[portalNum].cells.length > t.layout.length) {
                            var removed = curDashboard._options.items[portalNum].cells.pop();
                            curDashboard._options.items[portalNum].cells[0] = curDashboard._options.items[portalNum].cells[0].concat(removed);
                            mainViewport.findById("portal_panel_" + portalNum).remove(curPortal.items[curPortal.items.length - 1]);
                            for (var j = 0; j < removed.length; j++) {
                                curPortal.items[0].add(curDashboard.createCellObject(removed[j], portalNum, 0));
                            }
                        }
                        for (var j = 0; j < t.layout.length; j++) {
                            if (curPortal.items.length > j) {
                                curPortal.items[j].columnWidth = t.layout[j];
                            } else {
                                mainViewport.findById("portal_panel_" + portalNum).add(curDashboard.createColumnObject(t.layout[j]));
                            }
                        }
                        mainViewport.findById("center_panel_center").doLayout(true);
                    }
                });
            }
            if (typeof idPopupWindow != "undefined") {
                opWin.on("show", function() { idPopupWindow(); });
            }
            opWin.show();
        } 
        }),
        //        new Ext.menu.Item({text: DashboardResource.Hide, handler: function() {
        //            if (portalNum != curDashboard._options.defportal) {
        //                mainViewport.findById("dashboard_panel").hideTabStripItem(portalNum);
        //                curDashboard._options.items[portalNum].isHidden = true;
        //                mainViewport.findById("dashboard_panel").activate("portal_panel_"+curDashboard._options.defportal);
        //                curDashboard.saveState();
        //            } else {
        //                Ext.Msg.alert(DashboardResource.Warning, DashboardResource.CannotHide);
        //            }
        //        }}),
        //        new Ext.menu.Item({text: DashboardResource.Show, handler: function() {
        //            var win = new Ext.Window({title: DashboardResource.Show, 
        //                width: parseInt(DashboardResource.Popup_Width),
        //                height: parseInt(DashboardResource.Popup_Height),
        //                buttons: [{text: DashboardResource.Ok, handler: function(t, e){curDashboard.saveState();t.ownerCt.close();}}
        //                    ,{text: DashboardResource.Cancel, handler: function(t, e){
        //                        Ext.destroy(slxDashboard);
        //                        slxDashboard = new Sage.SalesLogix.Dashboard(origOptions);
        //                        slxDashboard.init();
        //                        t.ownerCt.close();}
        //                    }
        //                ]
        //            });
        //            for (var i=0; i< curDashboard._options.items.length; i++) {    
        //                if (curDashboard._options.items[i].isHidden) {
        //                    win.add(new Ext.form.Checkbox({boxLabel: curDashboard._options.items[i].name, 
        //                            portal: "portal_panel_"+i, 
        //                            index: i, 
        //                            checked: !curDashboard._options.items[i].isHidden}
        //                        )).on("check", function(t,checked){
        //                            if (checked) {  
        //                                curDashboard._options.items[t.index].isHidden = false;
        //                                mainViewport.findById("dashboard_panel").unhideTabStripItem(t.portal);
        //                            } else {
        //                                curDashboard._options.items[t.index].isHidden = true;
        //                                mainViewport.findById("dashboard_panel").hideTabStripItem(t.portal);
        //                            }
        //                        });
        //                }
        //            }
        //            win.show();
        //        }}),
        //        new Ext.menu.Item({text: DashboardResource.Make_Default, 
        //            icon: ((curDashboard._options.defportal == portalNum) ? "images/YUI/menuchk8_nrm_1.gif" : Ext.BLANK_IMAGE_URL),
        //            handler: function() {
        //                curDashboard._options.defportal = portalNum;
        //                curDashboard.saveState();
        //        }}),
        new Ext.menu.Item({
            text: DashboardResource.Delete_Tab,
            disabled: (portalNum == curDashboard._options.defportal),
            handler: function() {
            var confirm = Ext.Msg.confirm(DashboardResource.Delete_Tab, DashboardResource.ConfirmDelete, function(result) {
                    if (result == "yes") 
                        curDashboard.deletePortal(portalNum);    
                });
            }            
        }),
        new Ext.menu.Item({ text: DashboardResource.Help,
            icon: "images/icons/help_16x16.gif",
            handler: function() { window.open(Ext.get('hidWorkspaceHelpLink').getValue(), 'MCWebHelp') }
        })
    ]
    });
    if (typeof idMenuItems != "undefined") {
        tcmenu.on("show", function() { idMenuItems(); });
    }
    return tcmenu;
}

Sage.SalesLogix.Dashboard.prototype.saveState = function() {
    $.ajax({
        type: "POST",
        contentType: "application/json; charset=utf-8",
        url: "UIStateService.asmx/StoreUIState",
        data: Ext.util.JSON.encode({
            section: "Dashboard",
            key: "PortalConfig_"+document.forms[0].action.substring(document.forms[0].action.lastIndexOf('/')+1),
            value: Ext.util.JSON.encode(this._options)
        }),
        dataType: "json",
        error: function (request, status, error) {            
        },
        success: function(data, status) {            
        }
    });          
}

Sage.SalesLogix.Dashboard.prototype.deletePortal = function(portalNum) {    
    
    if (portalNum != this._options.defportal) 
    {
        var panel = mainViewport.findById("dashboard_panel");
        var tab = panel.findById("portal_panel_" + portalNum);
        
        if (tab) 
        {
            panel.remove(tab);
            this._options.items.splice(portalNum, 1);
            this.saveState();
        }
    }
    else
    {
        Ext.Msg.alert(DashboardResource.Warning, DashboardResource.CannotHide);
    }
    
    
}

Sage.SalesLogix.Dashboard.prototype.newPortal = function(name) {
           
    var curDashboard = this;    
    var item = {
        name: name,
        isHidden: false,
        layout: [1],
        cells: [[]]
    };       
    var number = this._options.items.push(item) - 1;    
    var panel = this._tabPanel.add({
        xtype: "portal",
        id: "portal_panel_" + number,
        title: this.createTitle(name, number),
        listeners: {
            "drop": {
                fn: function(args) {
                    var portalNum = args.portal.id.match(/\d+$/);
                    var smartpart = args.panel.location.cellitem;
                    var cells = curDashboard._options.items[portalNum].cells;
                    for (var i=0; i<cells.length; i++) {
                        cells[i].remove(smartpart);
                    }
                    cells[args.columnIndex].splice(args.position, 0, smartpart);  
                }
            },
            "contextmenu": { 
                fn: function(tabpanel, tab, e) {
                    var portalNum = parseInt(tab.id.match(/\d+$/), 10);
                    curDashboard.createTabContextMenu(portalNum).showAt(e.getXY());
                }
            }
        },
        items: (function(){
            var r = [];
            for (var i = 0; i < item.layout.length; i++)
                r.push(curDashboard.createColumnObject(item.layout[i]));
            return r;
        })()
    });  
    
    this.saveState(); 
       
    
    
    
}

function setUpDashboardPanels() {
    Ext.state.Manager.setProvider(new Ext.state.CookieProvider());
    mainViewport = new Ext.FormViewport({
        layout: "border",
        autoShow: false,
        border: false,
        bufferResize: true,
        items: [
            {
                region: "north",
                id: "north_panel",
                height: 62,
                title: false,
                collapsible: false,
                border: false,
                contentEl: "north_panel_content"
            },{
                region: "south",
                id: "south_panel",
                height: 20,
                collapsible: false,
                border: false,
                contentEl: "south_panel_content"   
            },{
                region: "west",
                id: "west_panel",   
                stateId: "west_panel",                
                border: false,
                split: true,
                width: 150,
                collapsible: true,
                collapseMode:'mini',
                margins: "0 0 0 0",
                cmargins: "0 0 0 0",
                layout:'accordion',
                sequence: true,                                
                defaults: {
                    stateEvents: ["collapse","expand"],
                    getState: function() {
                    return {collapsed:this.collapsed};
                    }
                },
                animCollapse: false,
                animFloat: false,
                layoutConfig:{
                    animate:false,
                    hideCollapseTool: true
                }
            },{
                region: "center",
                id: "center_panel",
                applyTo: "center_panel",                
                collapsible: false,
                border: false,
                margins: "6 6 6 6",
                cmargins: "0 0 0 0",
                layout: "border",
                items: [{ 
                    region: "center",
                    id: "center_panel_center",
                    applyTo: "center_panel_center",                    
                    border: false,
                    collapsible: false,
                    margins: "0 0 0 0",                    
                    autoScroll: false,
                    layout: "fit"                     
                }]
            }]
    });
}

function setNavState()
{
       for (var i = 0; i < NavBar_Menus.length; i++)
        {
          var item = mainViewport.findById('nav_bar_menu_' + i);
          if (item) item.saveState();
        }
}
Sage.DialogWorkspace = function(options) {
    this._initialized = false;
    this._id = options.id; 
    this._clientId = options.clientId;
    this._stateClientId = options.stateClientId;
    this._panelClientId = options.panelClientId;
    this._contentClientId = options.contentClientId;
    this._context = null;
    this._dialog = null;
    this._dialogPanel = null;
    this._closedOnServerSide = false;
    this._dialogInfo = {};
    this.addEvents(
        'open',
        'close'        
    );
    
    Sage.DialogWorkspace.__instances[this._clientId] = this;
    Sage.DialogWorkspace.__initRequestManagerEvents();
};
Ext.extend(Sage.DialogWorkspace, Ext.util.Observable);
Sage.DialogWorkspace.__maskCount = 0;
Sage.DialogWorkspace.__instances = {};
Sage.DialogWorkspace.__requestManagerEventsInitialized = false;
Sage.DialogWorkspace.__initRequestManagerEvents = function() {
    if (Sage.DialogWorkspace.__requestManagerEventsInitialized)
        return;        
    
    var contains = function(a, b) {
        if (!a || !b)
            return false;
        else
            return a.contains ? (a != b && a.contains(b)) : (!!(a.compareDocumentPosition(b) & 16));
    };
        
    var prm = Sys.WebForms.PageRequestManager.getInstance();
    prm.add_beginRequest(function(sender, args) {
        var element = args.get_postBackElement();
        if (element) 
        {
            for (var id in Sage.DialogWorkspace.__instances)
            {  
                var instance = Sage.DialogWorkspace.__instances[id];
                if (instance._context && contains(instance._context, element))
                {
                    instance.disable();
                }
            }
        }
        
        
    });
    prm.add_pageLoaded(function(sender, args) {        
        var panels = args.get_panelsUpdated();
        if (panels)
        {            
            for (var id in Sage.DialogWorkspace.__instances)
            {
                for (var i = 0; i < panels.length; i++)
                {
                    var instance = Sage.DialogWorkspace.__instances[id];              
                    if (contains(panels[i], document.getElementById(instance._stateClientId))) 
                    {          
                        instance.enable();                        
                        instance.handleEvents();
                        break;
                    }
                }                        
            }            
        }
    }); 
    
    //empty all state passing fields
    //have to do this here instead of in handleEvents() due to something causing
    //the original value to be reset after the pageLoaded() event
    prm.add_endRequest(function(sender, args) {
        for (var id in Sage.DialogWorkspace.__instances)
        {
            var instance = Sage.DialogWorkspace.__instances[id];              
            instance.clearState();
            instance.enable(); 
        }         
            
        
    });
     
    Sage.DialogWorkspace.__requestManagerEventsInitialized = true; 
};

Sage.DialogWorkspace.requestMask = function() {
    Sage.DialogWorkspace.__maskCount = Sage.DialogWorkspace.__maskCount + 1   
};

Sage.DialogWorkspace.prototype.init = function() {
    this.initContext();
    this.initDialog(); 
    
    $("#" + this._contentClientId).show();
    
    this.handleEvents();
};

Sage.DialogWorkspace.prototype.clearState = function() {
    $("#" + this._stateClientId).val("");  
};

Sage.DialogWorkspace.prototype.disable = function() {
    if (!this._dialog)
        return;   
        
    if (!this._dialog.isVisible())
        return;            

    this._dialog.disable();
};

Sage.DialogWorkspace.prototype.enable = function() {
    if (!this._dialog)
        return;
    
    if (!this._dialog.isVisible())
        return;        
    
    this._dialog.enable();
};

Sage.DialogWorkspace.prototype.show = function(o) {
    if (typeof o === "string")
        o = {id: o}
    
    o.event = "open";
    o.from = o.from || "client";
        
    var value = Sys.Serialization.JavaScriptSerializer.serialize(o);
    $("#" + this._stateClientId).val(value);  
    __doPostBack(this._stateClientId, '');
};

Sage.DialogWorkspace.prototype.initContext = function() {
    this._context = document.getElementById(this._clientId);
};

Sage.DialogWorkspace.prototype.initDialog = function() {
    var self = this;
    var content = new Ext.Panel({
        cls: "dialog-workspace-content-panel",
        id: this._contentClientId + "_panel", 
        contentEl: this._contentClientId,
        border: false,    
        allowDomMove: false,
        stateful: false
    });
    var wrapper = new Ext.Panel({
        id: this._clientId + "_wrapper", 
        cls: "dialog-workspace-wrapper",
        autoScroll: true,  
        border: false,             
        items: [content]
    });
    var dialog = new Ext.Window({
        id: this._clientId,
        tools: [{
            id: "help",
            handler: function() {
                if (self._dialogInfo.help && self._dialogInfo.help.url) 
                    window.open(self._dialogInfo.help.url, (self._dialogInfo.help.target || "help"));
            }
        }],
        items: [wrapper],
        allowDomMove: false,
        applyTo: Ext.get(this._clientId),       
        layout: "fit",
        closeAction: "hide",
        cls: "dialog-workspace",
        plain: true,
        stateful: false,
        constrain: true,
        
        modal: true                       
    }); 
    
    dialog.on('show', function(panel) {
        if (self._dialogInfo.help && self._dialogInfo.help.url) 
            panel.tools["help"].show();
        else
            panel.tools["help"].hide();
                       
        self.fireEvent('open', this);  
    });
    
    dialog.on('beforehide', function(panel) {
        if (self._closedOnServerSide)
            return; 
        
        var evt = {
            event: "close",
            id: self._dialogInfo.id
        };
        
        var bindingManager = Sage.Services.getService('ClientBindingManagerService');
        if (bindingManager) 
            bindingManager.rollbackCurrentTransaction();
            
        self._dialogInfo = {};                   
        
        var value = Sys.Serialization.JavaScriptSerializer.serialize(evt);
        $("#" + self._stateClientId).val(value);               
        
        Sage.DialogWorkspace.requestMask();
        
        __doPostBack(self._stateClientId, '');  
        
        return false;
    });
    
    dialog.on('hide', function(panel) {  
        self.fireEvent('close', this);
        
    });
    
    dialog.on('resize', function(window, width, height) {                
        dialog.doLayout();
    });
    
    this._dialogPanel = content;
    this._dialog = dialog;
};

Sage.DialogWorkspace.prototype.fitToViewport = function(size) {
    var win = {
        width: $(window).width(), 
        height: $(window).height()
    };
    var el = {
        width: $(this._dialogPanel.getEl().dom).find(".dialog-workspace-content").width(), 
        height: $(this._dialogPanel.getEl().dom).find(".dialog-workspace-content").height()
    };    
    var frame = {
        width: this._dialog.getFrameWidth(), 
        height: this._dialog.getFrameHeight()
    };
    
    if (el.width <= 0 || el.height <= 0)
        el = {width: 0, height: 0};
    
    var out = {
        width: (size.width + frame.width),
        
        
        height: (size.height + frame.height),
        left: false,
        top: false,
        scroll: false     
    };
    
    if (out.height > win.height)
    {
        out.height = win.height;
        out.top = 0;
        out.scroll = true; //can add adjustment to width for scroll here if necessary        
    }
    
    if (out.width > win.width) 
    {
        out.width = win.width;
        out.left = 0;            
    }
    
    return out;
};

Sage.DialogWorkspace.prototype.handleEvents = function() {
    //alert($("#" + this._stateClientId).val());   

    var value = $("#" + this._stateClientId).val();
    var evt = {};
    if (value)
        evt = eval("(" + value + ")");

    //clear event
    $("#" + this._stateClientId).val("");

    switch (evt.event) {
        case "open":
            if (this._dialog) {
                this._dialogInfo = evt;

                this._dialog.setTitle(this._dialogInfo.title);

                var size = this.fitToViewport({ width: evt.width, height: evt.height });

                this._dialog.setSize(size.width, size.height);                  
                    
                if (size.scroll)
                    this._dialog.addClass("dialog-workspace-scroll");
                else
                    this._dialog.removeClass("dialog-workspace-scroll");

                this._dialog.doLayout();
                this._dialog.show();
                
                if(evt.centerDialog)
                    this._dialog.center();
                else
                    this._dialog.setPosition(evt.left, evt.top);
            }
            break;
        case "close":
            if (this._dialog) {
                this._closedOnServerSide = true;
                this._dialog.hide();
                this._dialogInfo = {};
                this._closedOnServerSide = false;
            }
            if (this.onClose) {
                for (var i = 0; i < this.onClose.length; i++) {
                    this.onClose[i]();
                }
            }
            break;
    }
};
Sage.ContentPane = function(toggleBtn, contentArea, attr) {
	this.contentArea = contentArea;
	this.toggleButton = toggleBtn;
	this.state = "open";
	this.minImg = attr.minImg;
	this.maxImg = attr.maxImg
	this.minText = attr.minText;
	this.maxText = attr.maxText;
	var elem = YAHOO.util.Dom.get(toggleBtn);
	YAHOO.util.Event.removeListener(toggleBtn, 'click');
	YAHOO.util.Event.addListener(toggleBtn, 'click', this.toggle, this, true);
	YAHOO.util.Dom.setStyle(toggleBtn, "cursor", "pointer");
		
	if (typeof(cookie) != "undefined") {
		var st = cookie.getCookieParm(this.contentArea, "MainContentState");
		if (st) {
			if (st == "closed") {
				this.close();
			}
		}
	}
}

Sage.ContentPane.prototype.setState = function(state) {
	this.state = state;
	if (typeof(cookie) != "undefined") {
		cookie.setCookieParm(this.state, this.contentArea, "MainContentState");
	}
}

Sage.ContentPane.prototype.toggle = function() {
	if (this.state == "open") {
		this.close();
	} else {
		this.open();
	}
}

Sage.ContentPane.prototype.close = function() {
    
	YAHOO.util.Dom.setStyle(this.contentArea + "_inner", "display", "none");
	this.setState("closed");
	var elem = document.getElementById(this.toggleButton);
	if (elem) {
		elem.src = this.maxImg;
		elem.alt = this.maxText;
	}
}

Sage.ContentPane.prototype.open = function() {
    
	YAHOO.util.Dom.setStyle(this.contentArea + "_inner", "display", "block");
	this.setState("open");
	var elem = document.getElementById(this.toggleButton);
	if (elem) {
		elem.src = this.minImg;
		elem.alt = this.minText;
	}
}

Sage.ContentPaneAttr = function() {
	this.minImg = "";
	this.maxImg = "";
	this.minText = "";
	this.maxText = "";
}

var imgCollapse = new Image();
imgCollapse.src = "images/collapsedark.gif";
var imgExpand = new Image();
imgExpand.src = "images/expanddark.gif";

function toggleSmartPartVisiblity(contentID, img){
    var content = document.getElementById(contentID);
    if(content.style.display =="none"){
        content.style.display = "block";
    }
    else{
        content.style.display = "none";
    }
    if(img.src == imgCollapse.src){
        img.src = imgExpand.src;
    }
    else{
        img.src = imgCollapse.src;
    }
}



Sage.TabWorkspaceState = function(state) {
    this._state = state;
    this._wasTabUpdated = new Object;
    this._hiddenTabs = new Object;      
    this._collections = ['MiddleTabs', 'MainTabs', 'MoreTabs'];
    this._collectionActiveRef = {'MainTabs' : 'ActiveMainTab', 'MoreTabs' : 'ActiveMoreTab'};
    
    //sync the dictionary with the list
    for (var i = 0; i < this._state.UpdatedTabs.length; i++)
        this._wasTabUpdated[this._state.UpdatedTabs[i]] = true;
    
    for (var i = 0; i < this._state.HiddenTabs.length; i++)
        this._hiddenTabs[this._state.HiddenTabs[i]] = true;    
        
};

Sage.TabWorkspaceState.MIDDLE_TABS = 'MiddleTabs';
Sage.TabWorkspaceState.MAIN_TABS = 'MainTabs';
Sage.TabWorkspaceState.MORE_TABS = 'MoreTabs';

Sage.TabWorkspaceState.deserialize = function(value) {    
    try
    {
        var state = Sys.Serialization.JavaScriptSerializer.deserialize(value);
        return new Sage.TabWorkspaceState(state);
    }
    catch (e)
    {
        return null;
    }
};

Sage.TabWorkspaceState.prototype.serialize = function() {
    return Sys.Serialization.JavaScriptSerializer.serialize(this._state);
};

Sage.TabWorkspaceState.prototype.getObject = function() {
    return this._state;
};

Sage.TabWorkspaceState.prototype.getSectionFor = function(target) {
    if (this.isMiddleTab(target))
        return Sage.TabWorkspaceState.MIDDLE_TABS;
    if (this.isMainTab(target))
        return Sage.TabWorkspaceState.MAIN_TABS;
    if (this.isMoreTab(target))
        return Sage.TabWorkspaceState.MORE_TABS;
    return false;
};

Sage.TabWorkspaceState.prototype._isTab = function(collection, target) {
    if (typeof this._state[collection] != "object")
        return;
        
    for (var i in this._state[collection])
        if (this._state[collection][i] == target)
            return true;
    return false;
};

Sage.TabWorkspaceState.prototype._removeFromTabs = function(collection, target) {
    if (typeof this._state[collection] != "object")
        return;
        
    var result = [];
    jQuery.each(this._state[collection], function(i, value) {
        if (value != target)
            result.push(value);
    });
    this._state[collection] = result;
    
    //if the collection is question has an active reference, and that value is set to the target, set it to null
    if (typeof this._collectionActiveRef[collection] != 'undefined')
        if (this._state[this._collectionActiveRef[collection]] == target)
            this._state[this._collectionActiveRef[collection]] = null;
};

Sage.TabWorkspaceState.prototype._addToTabs = function(collection, target, at, step) {
    if (typeof this._state[collection] != "object")
        return;
        
    //remove it from the other collections
    for (var other in this._collections)
        if (other != collection)
            this._removeFromTabs(this._collections[other], target);
        
    if (typeof at != 'undefined')
    {
        if (typeof at == 'number')
        {
            this._state[collection].splice(at, 0, target);
        }
        else
        {
            var insertAt = this._state[collection].length;
            jQuery.each(this._state[collection], function(i, value) {
                if (value == at)
                {
                    insertAt = i;
                    return false;
                }
            });
            
            if (typeof step == 'number')
                insertAt = insertAt + step;
            
            this._state[collection].splice(insertAt, 0, target);
        }
    }
    else
    {
        this._state[collection].push(target);
    }
};

Sage.TabWorkspaceState.prototype.isMiddleTab = function(target) { 
    return this._isTab(Sage.TabWorkspaceState.MIDDLE_TABS, target); 
};

Sage.TabWorkspaceState.prototype.removeFromMiddleTabs = function(target) { 
    this._removeFromTabs(Sage.TabWorkspaceState.MIDDLE_TABS, target); 
};

Sage.TabWorkspaceState.prototype.addToMiddleTabs = function(target, at, step) { 
    this._addToTabs(Sage.TabWorkspaceState.MIDDLE_TABS, target, at, step); 
};

Sage.TabWorkspaceState.prototype.isMainTab = function(target) { 
    return this._isTab(Sage.TabWorkspaceState.MAIN_TABS, target); 
};

Sage.TabWorkspaceState.prototype.removeFromMainTabs = function(target) { 
    this._removeFromTabs(Sage.TabWorkspaceState.MAIN_TABS, target); 
};

Sage.TabWorkspaceState.prototype.addToMainTabs = function(target, at, step) { 
    this._addToTabs(Sage.TabWorkspaceState.MAIN_TABS, target, at, step); 
};

Sage.TabWorkspaceState.prototype.setActiveMainTab = function(target) { 
    this._state.ActiveMainTab = target; 
};

Sage.TabWorkspaceState.prototype.getActiveMainTab = function() { 
    return this._state.ActiveMainTab; 
};

Sage.TabWorkspaceState.prototype.isMoreTab = function(target) { 
    return this._isTab(Sage.TabWorkspaceState.MORE_TABS, target); 
};

Sage.TabWorkspaceState.prototype.removeFromMoreTabs = function(target) { 
    this._removeFromTabs(Sage.TabWorkspaceState.MORE_TABS, target); 
};

Sage.TabWorkspaceState.prototype.addToMoreTabs = function(target, at, step) { 
    this._addToTabs(Sage.TabWorkspaceState.MORE_TABS, target, at, step); 
};

Sage.TabWorkspaceState.prototype.setActiveMoreTab = function(target) { 
    this._state.ActiveMoreTab = target; 
};

Sage.TabWorkspaceState.prototype.getActiveMoreTab = function() { 
    return this._state.ActiveMoreTab; 
};

Sage.TabWorkspaceState.prototype.getMainTabs = function() {
    return this._state.MainTabs;
};

Sage.TabWorkspaceState.prototype.getMoreTabs = function() {
    return this._state.MoreTabs;
};

Sage.TabWorkspaceState.prototype.getMiddleTabs = function() {
    return this._state.MiddleTabs;
};

Sage.TabWorkspaceState.prototype.getUpdatedTabs = function() {
    return this._state.UpdatedTabs;
};

Sage.TabWorkspaceState.prototype.markTabUpdated = function(target) {
    if (this._wasTabUpdated[target])
        return;
         
    this._wasTabUpdated[target] = true;
    this._state.UpdatedTabs.push(target);
};

Sage.TabWorkspaceState.prototype.wasTabUpdated = function(target) {
    return this._wasTabUpdated[target];
};

Sage.TabWorkspaceState.prototype.clearUpdatedTabs = function() {
    this._wasTabUpdated = new Object;
    this._state.UpdatedTabs = [];
};

Sage.TabWorkspaceState.prototype.getHiddenTabs = function() {
    return this._state.HiddenTabs;
};
Sage.TabWorkspaceState.prototype.InHideMode = function() {
    return this._state.InHideMode;
};
Sage.TabWorkspace = function(config) {
    this._id = config.id;
    this._clientId = config.clientId;
    this._afterPostBackActions = [];       
    this._info = config.info;
    this._state = new Sage.TabWorkspaceState(config.state);            
    this._textSelectionDisabled = false;      
    this._debug = false;     
    this._regions = {}; 
    this._middleRegionDropTolerance = 20;
    this._offsetParent = false;
    this._offsetParentScroll = -1;
    
    this.compileInfoLookups();
    
    Sage.TabWorkspace.superclass.constructor.apply(this);
    
    this.addEvents(
        'maintabchange',
        'moretabchange'        
    );
};

Ext.extend(Sage.TabWorkspace, Ext.util.Observable);

Sage.TabWorkspace.MORE_TAB_ID = "More";
Sage.TabWorkspace.MAIN_AREA = "main";
Sage.TabWorkspace.MORE_AREA = "more";
Sage.TabWorkspace.MIDDLE_AREA = "middle";

Sage.TabWorkspace.prototype.compileInfoLookups = function() {
    this._info._byId = new Object;
    this._info._byElementId = new Object;
    this._info._byDropTargetId = new Object;
    this._info._byButtonId = new Object;
    this._info._byMoreButtonId = new Object;
    for (var i = 0; i < this._info.Tabs.length; i++)
    {
        this._info._byId[this._info.Tabs[i].Id] = this._info.Tabs[i];
        this._info._byElementId[this._info.Tabs[i].ElementId] = this._info.Tabs[i];
        this._info._byDropTargetId[this._info.Tabs[i].DropTargetId] = this._info.Tabs[i];
        this._info._byButtonId[this._info.Tabs[i].ButtonId] = this._info.Tabs[i];
        this._info._byMoreButtonId[this._info.Tabs[i].MoreButtonId] = this._info.Tabs[i];
    }
};

Sage.TabWorkspace.prototype.getInfoFor = function(tab) { return this._info._byId[tab]; };
Sage.TabWorkspace.prototype.getInfoForTab = function(tabId) { return this._info._byId[tabId]; };
Sage.TabWorkspace.prototype.getInfoForTabElement = function(elementId) { return this._info._byElementId[elementId]; };
Sage.TabWorkspace.prototype.getInfoForTabDropTarget = function(dropTargetId) { return this._info._byDropTargetId[dropTargetId]; };
Sage.TabWorkspace.prototype.getInfoForTabButton = function(buttonId) { return this._info._byButtonId[buttonId]; };
Sage.TabWorkspace.prototype.getInfoForTabMoreButton = function(buttonId) { return this._info._byMoreButtonId[buttonId]; };
Sage.TabWorkspace.prototype.getStateProxyTriggerId = function() { return this._info.ProxyTriggerId; };
Sage.TabWorkspace.prototype.getStateProxyPayloadId = function() { return this._info.ProxyPayloadId; };
Sage.TabWorkspace.prototype.getDragHelperContainerId = function() { return this._info.DragHelperContainerId; };
Sage.TabWorkspace.prototype.getUseUIStateService = function() { return this._info.UseUIStateService; };
Sage.TabWorkspace.prototype.getUIStateServiceKey = function() { return this._info.UIStateServiceKey; };
Sage.TabWorkspace.prototype.getUIStateServiceProxyType = function() { return this._info.UIStateServiceProxyType; };
Sage.TabWorkspace.prototype.getAllDropTargets = function() { return this._allDropTargets; };
Sage.TabWorkspace.prototype.getAllMainButtons = function() { return this._allMainButtons; };
Sage.TabWorkspace.prototype.getAllMoreButtons = function() { return this._allMoreButtons; };

Sage.TabWorkspace.prototype.getElement = function() {
    if (document.getElementById)
        return document.getElementById(this._clientId);
    return null;
};

Sage.TabWorkspace.prototype.getContext = function() { return this._context; };
Sage.TabWorkspace.prototype.getState = function() { return this._state; };
Sage.TabWorkspace.prototype.setState = function(state) { this._state = state; };

Sage.TabWorkspace.prototype.resetState = function(state)
{
	if (typeof state === "undefined")
	{
		var stateProxy = $("#" + this.getStateProxyPayloadId(), this.getContext()).val();
		if (stateProxy == "")
		{
			this.setState(this.getState());
		}
		else
		{
			this.setState(Sage.TabWorkspaceState.deserialize(stateProxy)); 
		} 
	}
	else if (typeof state === "string")
	{
		this.setState(Sage.TabWorkspaceState.deserialize(state));
	}
	this.logDebug("Reset state...");
};

Sage.TabWorkspace.prototype.logDebug = function(text) {
    if (this._debug)
    {
        var pad = function(value, length) {
            value = value.toString();
            while (value.length < length)
                value = "0" + value;
            return value;
        };
        var date = new Date();
        var dateString = pad(date.getHours(),2) + ":" + pad(date.getMinutes(),2) + ":" + pad(date.getSeconds(),2) + "." + pad(date.getMilliseconds(),3);
        $("#debug_log").append(dateString + " - " + text + "<br />");
    }
};

Sage.TabWorkspace.prototype.registerAfterPostBackAction = function(action) {
    this._afterPostBackActions.push(action);
};

Sage.TabWorkspace.prototype.init = function() { 
    this.logDebug("[enter] init"); 
    
    //cache common lookups               
    if (document.getElementById)
        this._context = document.getElementById(this._clientId);    
        
    if (this._context)
        this._offsetParent = $(this._context).offsetParent();
    
    this._allDropTargets = $("div.tws-drop-target", this._context);
    this._allMainButtons = $("li.tws-tab-button", this._context);
    this._allMoreButtons = $("li.tws-more-tab-button", this._context);
    this._mainButtonContainer = $("div.tws-main-tab-buttons", this._context);
    this._mainButtonContainerRegion = this.createRegionsFrom(this._mainButtonContainer)[0];
    this._moreButtonContainer = $("div.tws-more-tab-buttons-container", this._context);
    this._moreButtonContainerRegion = this.createRegionsFrom(this._moreButtonContainer)[0];
    
    this.getState().clearUpdatedTabs();
    for (var i = 0; i < this.getState().getMiddleTabs().length; i++)
        this.getState().markTabUpdated(this.getState().getMiddleTabs()[i]);
        
    if (this.getState().getActiveMainTab())
        this.getState().markTabUpdated(this.getState().getActiveMainTab());         
    
    if (this.getState().getActiveMainTab() == Sage.TabWorkspace.MORE_TAB_ID) 
        if (this.getState().getActiveMoreTab())
            this.getState().markTabUpdated(this.getState().getActiveMoreTab());
        
    //store the helper height & width   
    this._dragHelperHeight = $(".tws-tab-drag-helper", this.getContext()).height();
    this._dragHelperWidth = $(".tws-tab-drag-helper", this.getContext()).width();  
        
    this.logDebug("[enter] initEvents");
    this.initEvents();
    this.logDebug("[leave] initEvents");
    this.logDebug("[enter] initDragDrop");
    this.initDragDrop();
    this.logDebug("[leave] initDragDrop");
    this.logDebug("[leave] init");
    this.hideTabs();
};

Sage.TabWorkspace.prototype.initEvents = function() {
    var self = this; //since jQuery overrides "this" in the closure        
    
    //setup the update events
    //will need to refactor this to use add_endRequest instead
    var prm = Sys.WebForms.PageRequestManager.getInstance();
    prm.add_endRequest(function(sender, args) {  
        self.setupAllTabElementDraggables();
        self.hideTabs();
    });   
    
    prm.add_beginRequest(function(sender, args) {
        self.cleanupAllTabElementDraggables();
    });
};

Sage.TabWorkspace.prototype.hideTabs = function() 
{
     if(!this.getState().InHideMode())
     {
        return;
     } 
     for (var i = 0; i < this.getState().getMiddleTabs().length; i++)
     {
        var tab =this.getState().getMiddleTabs()[i];                
        this.unHideTab(tab);       
     } 
     
     for (var i = 0; i < this.getState().getMoreTabs().length; i++)
     {
        var tab =this.getState().getMoreTabs()[i];                
        this.unHideTab(tab);       
     } 
     
     for (var i = 0; i < this.getState().getMainTabs().length; i++)
     {
        var tab =this.getState().getMainTabs()[i];                
        this.unHideTab(tab);       
     } 
          
     for (var i = 0; i < this.getState().getHiddenTabs().length; i++)
     {
        var tab =this.getState().getHiddenTabs()[i];                
        this.hideTab(tab);       
     }
};

Sage.TabWorkspace.prototype.hideTab = function(tab) {
    this.logDebug("[enter] hideTab");
    if (typeof tab === "string")
        tab = this.getInfoFor(tab);
       
            
    switch (this.getState().getSectionFor(tab.Id))
    {
        case Sage.TabWorkspaceState.MAIN_TABS:                   
            
            $("#" + tab.ButtonId, this.getContext()).hide(); 
            $("#" + tab.ElementId, this.getContext()).hide();
            break;
            
        case Sage.TabWorkspaceState.MORE_TABS:
              
            $("#" + tab.MoreButtonId, this.getContext()).hide();
            $("#" + tab.ElementId, this.getContext()).hide();
            break;
            
        case Sage.TabWorkspaceState.MIDDLE_TABS:                 
            $("#" + tab.ElementId, this.getContext()).hide();
            break;
     }  
     
};

Sage.TabWorkspace.prototype.unHideTab = function(tab) {
    this.logDebug("[enter] hideTab");
    if (typeof tab === "string")
        tab = this.getInfoFor(tab);
       
    switch (this.getState().getSectionFor(tab.Id))
    {
        case Sage.TabWorkspaceState.MAIN_TABS:                   
            
            $("#" + tab.ButtonId, this.getContext()).show();
            if (this.getState().getActiveMainTab() == tab.Id)
            {
               $("#" + tab.ElementId, this.getContext()).show();       
            }
            
            break;
            
        case Sage.TabWorkspaceState.MORE_TABS:
                    
            $("#" + tab.MoreButtonId, this.getContext()).show();
            if (this.getState().getActiveMoreTab() == tab.Id)
            {
               $("#" + tab.ElementId, this.getContext()).show();       
            }
            break;
            
        case Sage.TabWorkspaceState.MIDDLE_TABS:                 
                        
             $("#" + tab.ElementId, this.getContext()).show();          
                              
            break;
     }  
     
};


Sage.TabWorkspace.prototype.disablePageTextSelection = function() {
    if (jQuery.browser.msie)
    {
        if (!this._textSelectionDisabled)
        {                
            this._oldBodyOnDrag = document.body.ondrag;
            this._oldBodyOnSelectStart = document.body.onselectstart;
            
            document.body.ondrag = function () { return false; };
            document.body.onselectstart = function () { return false; };
            
            this._textSelectionDisabled = true;
        }
    }
};

Sage.TabWorkspace.prototype.enablePageTextSelection = function() {
    if (jQuery.browser.msie)
    {
        if (this._textSelectionDisabled)
        {        
            document.body.ondrag = this._oldBodyOnDrag;
            document.body.onselectstart = this._oldBodyOnSelectStart;
            
            this._textSelectionDisabled = false;
        }
    }
};

Sage.TabWorkspace.prototype.setDragDropHelperText = function(helper, text) {
    if (typeof text != "string")
        return;
            
    $(".tws-drag-helper-text", helper).html(text);
}

Sage.TabWorkspace.prototype.setupTabElementDraggable = function(tab) {
    var self = this;
        
    var $query;      
    if (typeof tab == 'string')
        $query = $("#" + this.getInfoFor(tab).ElementId, this.getContext());
    else if (typeof target == 'object')
        $query = tab.ElementId;
        
    if ($query.is(".ui-draggable"))
        return;
           
    if (typeof tab === "string")
        this.logDebug("Setting up tab element draggable for " + tab + ".");
    else
        this.logDebug("Setting up tab element draggable for " + tab.Id + ".");
            
    $query.draggable({        
        handle : ".tws-tab-view-header",
        cursor : "move",
        cursorAt : { top : self._dragHelperHeight / 2, left : self._dragHelperWidth / 2 },
        zIndex : 15000,  
        delay: 50,    
        opacity : 0.5,
        scroll: true,
        refreshPositions: true,
        appendTo : "#" + self.getDragHelperContainerId(),
        helper : function() {             
            return self.createDraggableHelper(); 
        },
        start : function(e, ui) {        
            this._context = self.getInfoForTabElement(this.id);
            this._overDraggable = false;
            
            $(ui.helper).data("over", 0);
            
            self.disablePageTextSelection();                          
            self.setDragDropHelperText(ui.helper, this._context.Name);     
        },
        stop : function(e, ui) {
            self.enablePageTextSelection();
        }
    });
};

Sage.TabWorkspace.prototype.cleanupTabElementDraggable = function(tab) {
    var $query;      
    if (typeof tab == 'string')
        $query = $("#" + this.getInfoFor(tab).ElementId, this.getContext());
    else if (typeof target == 'object')
        $query = tab.ElementId;
    
    if (!$query.is(".ui-draggable"))
            return;
            
    if (typeof tab === "string")
        this.logDebug("Cleaning up tab element draggable for " + tab + ".");
    else
        this.logDebug("Cleaning up tab element draggable for " + tab.Id + ".");
    
    $query.draggable("destroy");                        
};

Sage.TabWorkspace.prototype.setupAllTabElementDraggables = function() {
    for (var i = 0; i < this.getState().getMiddleTabs().length; i++)
        this.setupTabElementDraggable(this.getState().getMiddleTabs()[i]);
        
    if (this.getState().getActiveMainTab() && this.getState().getActiveMainTab() != Sage.TabWorkspace.MORE_TAB_ID)
        this.setupTabElementDraggable(this.getState().getActiveMainTab());
    
    if (this.getState().getActiveMoreTab())
        this.setupTabElementDraggable(this.getState().getActiveMoreTab());   
};

Sage.TabWorkspace.prototype.cleanupAllTabElementDraggables = function() {
    //only updated tabs should have tab element draggables
    for (var i = 0; i < this.getState().getUpdatedTabs().length; i++)
        this.cleanupTabElementDraggable(this.getState().getUpdatedTabs()[i]);
};

Sage.TabWorkspace.prototype.createMainInsertMarker = function(el, at) {          
    if (el)
    {
        var marker = $("<div class=\"tws-insert-button-marker\"></div>").css({ top: (at.top - 24) + "px", left: (at.left - 12) + "px" });
        $("div.tws-main-tab-buttons", this.getContext()).append(marker);
        el._marker = marker;
    }
};

Sage.TabWorkspace.prototype.cleanupMainInsertMarker = function(el) {
    if (el && el._marker)
    {
        el._marker.remove();
        el._marker = null;
    }
};

Sage.TabWorkspace.prototype.createMoreInsertMarker = function(el, at) {          
    if (el)
    {
        var marker = $("<div class=\"tws-insert-button-marker\"></div>").css({ top : (at.top - 12) + "px" });
        $("div.tws-more-tab-buttons-container", this.getContext()).append(marker);
        el._marker = marker;
    }
};

Sage.TabWorkspace.prototype.cleanupMoreInsertMarker = function(el) {
    if (el && el._marker)
    {
        el._marker.remove();
        el._marker = null;
    }
};

Sage.TabWorkspace.prototype.getContextFromUI = function(ui) {    
    return ui.draggable.get(0)._context;  
};

Sage.TabWorkspace.prototype.getRegions = function(area) {
    return this._regions[area];
};

Sage.TabWorkspace.prototype.createRegionsFrom = function(list) {
    var regions = [];
    list.each(function() {
        var el = $(this);
        regions.push({ 
            x: el.offset().left,
            y: el.offset().top,
            width: el.width(),
            height: el.height(),
            el: this
        });
    });
    
    return regions;
};

Sage.TabWorkspace.prototype.testRegions = function(regions, pos, test) {
    var list = (typeof regions === "string") ? this._regions[regions] : regions;
    if (list && list.length && typeof test === "function")
    {
        for (var i = 0; i < list.length; i++)
        {
            if (test(list[i], pos))
                return list[i].el;
        }
    }
    
    return null;
};

Sage.TabWorkspace.prototype.setDroppableOn = function(draggable, id, droppable) {
    if (typeof draggable._droppables === "undefined")
        draggable._droppables = {};
        
    draggable._droppables[id] = droppable;
};

Sage.TabWorkspace.prototype.getDroppableFrom = function(draggable, id) {
    if (draggable._droppables)
        return draggable._droppables[id];
};

Sage.TabWorkspace.prototype.updateOffsetParentScroll = function() {
    this._offsetParentScroll = $(this._offsetParent).scrollTop();
};

Sage.TabWorkspace.prototype.shouldUpdateRegions = function() {
    if (this._offsetParent) 
    {
        if (this._offsetParentScroll != $(this._offsetParent).scrollTop())
        {
            this._offsetParentScroll = $(this._offsetParent).scrollTop();
            return true;
        }
    }
    
    return false;
};

Sage.TabWorkspace.prototype.initDragDrop = function() {
    var self = this;    
    
    
    
    
    $("div.tws-middle-section", this.getContext()).droppable({
        
        accept : ".tws-tab-button,.tws-more-tab-button,.tws-tab-element",
        tolerance : "pointer",
        activate : function(e, ui) {
            self.logDebug("Activate MiddleSection");
            
            //add our instance to the draggable
            self.setDroppableOn(ui.draggable.get(0), Sage.TabWorkspace.MIDDLE_AREA, ui.options);
                        
            self._allDropTargets.filter("div.tws-middle-section div.tws-drop-target").addClass("tws-drop-target-active");
        },    
        deactivate : function(e, ui) {
            self.logDebug("De-Activate MiddleSection");
                        
            self._allDropTargets.filter("div.tws-middle-section div.tws-drop-target").removeClass("tws-drop-target-active");
            
            ui.draggable.unbind('drag', ui.options.track);             
            ui.options._targets = null;
            ui.options._current = null;            
        },
        over : function(e, ui) {
            self.logDebug("Over MiddleSection");
                        
            var regions = self.createRegionsFrom(self.getAllDropTargets().filter(":visible"));
            var draggable = ui.draggable.get(0);
            var pos = { y: e.pageY, x: e.pageX };  
            var el = self.testRegions(regions, pos, function(r, p) { return (p.y > (r.y - self._middleRegionDropTolerance) && p.y <= (r.y + r.height + self._middleRegionDropTolerance)) });
            
            if (el)
            {
                $(el).addClass("tws-drop-target-hover");                 
                $(ui.helper).data("over", $(ui.helper).data("over") + 1);     
                $(ui.helper).addClass("tws-drag-helper-valid");                                   
            }

            ui.options._targets = regions;
            ui.options._currentTarget = (el) ? el : null;
            ui.draggable.bind('drag', ui.options.track);
        },
        out : function(e, ui) {
            self.logDebug("Out MiddleSection");
            
            var draggable = ui.draggable.get(0);
            
            self._allDropTargets.removeClass("tws-drop-target-hover");
            
            $(ui.helper).data("over", $(ui.helper).data("over") - 1);
            if ($(ui.helper).data("over") <= 0)
            {
                $(ui.helper).data("over", 0);            
                $(ui.helper).removeClass("tws-drag-helper-valid"); 
            }
                                                                        
            ui.draggable.unbind('drag', ui.options.track);
            ui.options._targets = null;
            ui.options._currentTarget = null;
        },
        drop : function(e, ui) {
            self.logDebug("Drop MiddleSection");
            
            var context = self.getContextFromUI(ui);    
            var target = ui.options._currentTarget;
 
            self._allDropTargets.removeClass("tws-drop-target-hover");            
            $(ui.helper).removeClass("tws-drag-helper-valid");
            
            if (target)           
                self.dropToMiddleSection(context, target);                
        },
        track : function(e, ui) {          
            var draggable = this;
            var droppable = self.getDroppableFrom(draggable, Sage.TabWorkspace.MIDDLE_AREA);
            var pos = { y: e.pageY, x: e.pageX };
            var el = self.testRegions(droppable._targets, pos, function(r, p) { return (p.y > (r.y - self._middleRegionDropTolerance) && p.y <= (r.y + r.height + self._middleRegionDropTolerance)) });

            if (droppable._currentTarget != el)
            {
                var last = droppable._currentTarget;
                if (last) 
                {
                    $(ui.helper).removeClass("tws-drag-helper-valid");
                    $(last).removeClass("tws-drop-target-hover");
                }
                    
                if (el)                                
                {
                    $(ui.helper).addClass("tws-drag-helper-valid");
                    $(el).addClass("tws-drop-target-hover");
                }
                
                droppable._currentTarget = el;
            }
        }
    });
    
    
    
    
    $("div.tws-main-tab-buttons", this.getContext()).droppable({
        accept : ".tws-tab-button,.tws-more-tab-button,.tws-tab-element",                      
        tolerance : "pointer",
        activate : function(e, ui) {
            self.logDebug("Activate MainButtonBar");
            
            //not functional in ui 1.5 - is there an equivalent and is it needed?    
            //ui.instance.proportions.width = ui.instance.element.width();
            //ui.instance.proportions.height = ui.instance.element.height(); 
            
            self.updateMainAreaRegions(); 
            
            self.setDroppableOn(ui.draggable.get(0), Sage.TabWorkspace.MAIN_AREA, ui.options);                        
        },
        deactivate : function(e, ui) {
            self.logDebug("De-Activate MainButtonBar");
            
            self.cleanupMainInsertMarker(ui.draggable.get(0));
            
            ui.draggable.unbind('drag', ui.options.track);
            ui.options._targets = null;
            ui.options._currentTarget = null;            
        },
        over : function(e, ui) {      
            self.logDebug("Over main button bar event occured for " + self.getContextFromUI(ui).Id);                                             
            
            $(ui.helper).data("over", $(ui.helper).data("over") + 1);     
            $(ui.helper).addClass("tws-drag-helper-valid");   
            
            var regions = self.getRegions(Sage.TabWorkspace.MAIN_AREA);
            var pos = { y: e.pageY, x: e.pageX };  
            var el = self.testRegions(regions, pos, function(r, p) {
                return (p.x > r.x && p.x <= (r.x + r.width) &&
                        p.y > r.y && p.y <= (r.y + r.height));
            });
            var position = {};
                if (el)
                    position = $(el, self.getContext()).position();
                else
                    position = $(".tws-tab-button-tail", self.getContext()).position();                        
            
            self.cleanupMainInsertMarker(ui.draggable.get(0)); 
            self.createMainInsertMarker(ui.draggable.get(0), position);
            
            ui.options._targets = regions;
            ui.options._currentTarget = null;
            ui.draggable.bind('drag', ui.options.track);
        },
        out : function(e, ui) {
            self.logDebug("Out MainButtonBar");
            
            $(ui.helper).data("over", $(ui.helper).data("over") - 1);
            if ($(ui.helper).data("over") <= 0)
            {
                $(ui.helper).data("over", 0);     
                $(ui.helper).removeClass("tws-drag-helper-valid"); 
            }
            
            self.cleanupMainInsertMarker(ui.draggable.get(0));           
                                    
            ui.draggable.unbind('drag', ui.options.track);
            ui.options._targets = null;
            ui.options._currentTarget = null;
        },
        drop : function(e, ui) {    
            self.logDebug("Drop to main event occured for " + self.getContextFromUI(ui).Id);   
            
            var context = self.getContextFromUI(ui);    
            var target = (ui.options._currentTarget) ? ui.options._currentTarget : this;                                                                     
            self.dropToMainSection(context, target);
        },        
        track : function(e, ui) {            
            var draggable = this;
            var droppable = self.getDroppableFrom(draggable, Sage.TabWorkspace.MAIN_AREA);
            var pos = { y: e.pageY, x: e.pageX };  
            var el = self.testRegions(droppable._targets, pos, function(r, p) {
                return (p.x > r.x && p.x <= (r.x + r.width) &&
                        p.y > r.y && p.y <= (r.y + r.height));
            });
           
            if (droppable._currentTarget != el)
            {
                droppable._currentTarget = el;
                
                var position = {};
                if (el)
                    position = $(droppable._currentTarget, self.getContext()).position();
                else
                    position = $(".tws-tab-button-tail", self.getContext()).position();
                
                self.cleanupMainInsertMarker(draggable); 
                self.createMainInsertMarker(draggable, position);
            }            
        }     
    });        
    
    
    
    
    $(".tws-more-tab-buttons", this.getContext()).droppable({
        accept : ".tws-tab-button:not(#show_More),.tws-more-tab-button,.tws-tab-element:not(#element_More)",            
        tolerance : "pointer",
        activate : function(e, ui) {
            self.logDebug("Activate MoreButtonBar");                       
            
            //fix for jQuery 1.5 and size of initially hidden droppables             
                     
            //not functional in ui 1.5 - is there an equivalent and is it needed?    
            //ui.instance.proportions.width = ui.instance.element.width();
            //ui.instance.proportions.height = ui.instance.element.height(); 
            
            self.updateMoreAreaRegions(); 
            
            self.setDroppableOn(ui.draggable.get(0), Sage.TabWorkspace.MORE_AREA, ui.options);
        },
        deactivate : function(e, ui) {
            self.cleanupMoreInsertMarker(ui);    
            
            ui.draggable.unbind('drag', ui.options.track);
            ui.options._targets = null;
            ui.options._currentTarget = null; 
        },
        over : function(e, ui) {
            self.logDebug("Over more button bar event occured for " + self.getContextFromUI(ui).Id);                                             
            
            $(ui.helper).data("over", $(ui.helper).data("over") + 1);     
            $(ui.helper).addClass("tws-drag-helper-valid");   
            
            var regions = self.getRegions(Sage.TabWorkspace.MORE_AREA);
            var pos = { y: e.pageY, x: e.pageX };  
            var el = self.testRegions(regions, pos, function(r, p) { return (p.y > r.y && p.y <= (r.y + r.height)) }); 
            var position = {};
                if (el)
                    position = $(el, self.getContext()).position();
                else
                    position = $(".tws-more-tab-button-tail", self.getContext()).position();
            
            self.cleanupMoreInsertMarker(ui.draggable.get(0)); 
            self.createMoreInsertMarker(ui.draggable.get(0), position); 
            
            ui.options._targets = regions;
            ui.options._currentTarget = null;
            ui.draggable.bind('drag', ui.options.track);                     
        },
        out : function(e, ui) {
            $(ui.helper).data("over", $(ui.helper).data("over") - 1);
            if ($(ui.helper).data("over") <= 0)
            {
                $(ui.helper).data("over", 0);     
                $(ui.helper).removeClass("tws-drag-helper-valid"); 
            }  
            
            self.cleanupMoreInsertMarker(ui.draggable.get(0)); 
            
            ui.draggable.unbind('drag', ui.options.track);
            ui.options._targets = null;
            ui.options._currentTarget = null;                      
        },
        drop : function(e, ui) {    
            self.logDebug("Drop to more event occured for " + self.getContextFromUI(ui).Id);
            
            var context = self.getContextFromUI(ui);    
            var target = (ui.options._currentTarget) ? ui.options._currentTarget : this;                                                                                                   
            self.dropToMoreSection(context, target);
        },          
        track : function(e, ui) {            
            var draggable = this; 
            var droppable = self.getDroppableFrom(draggable, Sage.TabWorkspace.MORE_AREA);
            var pos = { y: e.pageY, x: e.pageX };  
            var el = self.testRegions(droppable._targets, pos, function(r, p) { return (p.y > r.y && p.y <= (r.y + r.height)) }); 
                       
            if (droppable._currentTarget != el)
            {
                droppable._currentTarget = el;
                
                var position = {};
                if (el)
                    position = $(droppable._currentTarget, self.getContext()).position();
                else
                    position = $(".tws-more-tab-button-tail", self.getContext()).position();
                
                self.cleanupMoreInsertMarker(draggable); 
                self.createMoreInsertMarker(draggable, position);
            }            
        }  
    });
    
    
    
        
    $("li.tws-tab-button:not(li.tws-tab-button-tail)", this.getContext()).draggable({
        cursor : "move",
        cursorAt : { top : self._dragHelperHeight / 2, left : self._dragHelperWidth / 2 },
        zIndex : 15000,       
        appendTo : "#" + self.getDragHelperContainerId(),
        //refreshPositions : true,
        opacity: 0.5,
        delay: 50,    
        scroll: true,
        refreshPositions: true,
        helper : function() {             
            return self.createDraggableHelper(); 
        },
        start : function(e, ui) {  
            this._context = self.getInfoForTabButton(this.id);
            this._overDraggable = false;
            
            $(ui.helper).data("over", 0);
            
            self.disablePageTextSelection();            
            self.setDragDropHelperText(ui.helper, this._context.Name);  
        },
        stop : function(e, ui) {
            self.enablePageTextSelection();
        }
    });
    
    
    
    
    $("li.tws-more-tab-button:not(li.tws-more-tab-button-tail)", this.getContext()).draggable({
        cursor : "move",
        cursorAt : { top : self._dragHelperHeight / 2, left : self._dragHelperWidth / 2 },
        zIndex : 15000,     
        //refreshPositions : true,  
        opacity: 0.5,  
        delay: 50,   
        scroll: true,
        refreshPositions: true,
        appendTo : "#" + self.getDragHelperContainerId(),
        helper : function() {             
            return self.createDraggableHelper(); 
        },
        start : function(e, ui) {  
            this._context = self.getInfoForTabMoreButton(this.id);
            this._overDraggable = false;
            
            $(ui.helper).data("over", 0);
            
            self.disablePageTextSelection();            
            self.setDragDropHelperText(ui.helper, this._context.Name);  
        },
        stop : function(e, ui) {
            self.enablePageTextSelection();
        }
    });       
    
    $("li.tws-tab-button:not(li.tws-tab-button-tail)", this.getContext()).click(function(e) {
        var tab = self.getInfoForTabButton($(this).attr("id"));
        
        self.logDebug("Click event occured for " + tab.Id);
        
        self.showMainTab(tab.Id);
        
        if (e.ctrlKey)
            this.forceUpdateFor(tab.Id);
    });  
    
    $("li.tws-more-tab-button:not(li.tws-more-tab-button-tail)", this.getContext()).click(function(e) {
        var tab = self.getInfoForTabMoreButton($(this).attr("id"));
        
        self.logDebug("Click event occured for " + tab.Id);
        
        self.showMoreTab(tab.Id);
        
        if (e.ctrlKey)
            this.forceUpdateFor(tab.Id);    
    });     
    
    this.updateAllRegions();
    this.setupAllTabElementDraggables();   
};

Sage.TabWorkspace.prototype.createDraggableHelper = function() {
    return $("<div class='tws-tab-drag-helper'><div class='tws-drag-helper-icon' /><div class='tws-drag-helper-text' /></div>");
};

Sage.TabWorkspace.prototype.showMainTab = function(tab, triggerUpdate) { 
    this.logDebug("[enter] showMainTab");
    
    if (typeof tab === "string")
        tab = this.getInfoFor(tab);
        
    var previousMainTabId = this.getState().getActiveMainTab();
    
    //if we are already the active main tab, we do not have to do anything
    if (this.getState().getActiveMainTab() == tab.Id)
    {
        //still optionally trigger an update
        if (typeof triggerUpdate == 'undefined' || triggerUpdate)
            this.triggerUpdateFor(tab.Id); 
        return;
    }
                
    //change state
    this.getState().setActiveMainTab(tab.Id);
      
    
    
    this.showMainTabDom(tab);
    
    if (tab.Id == Sage.TabWorkspace.MORE_TAB_ID)
        if (this.getState().getActiveMoreTab())
            this.showMoreTabDom(this.getState().getActiveMoreTab());
   
    if (typeof triggerUpdate == 'undefined' || triggerUpdate)
            this.triggerUpdateFor(tab.Id);     
            
    this.fireEvent('maintabchange', tab.Id, tab);     
};

Sage.TabWorkspace.prototype.showMainTabDom = function(tab) {
    
    if (typeof tab === "string")
        tab = this.getInfoFor(tab);
        
    $(".tws-main-tab-content > .tws-tab-element", this.getContext()).hide();
    $("#" + tab.ElementId, this.getContext()).show();
    $(".tws-main-tab-buttons .tws-tab-button", this.getContext()).removeClass("tws-active-tab-button"); 
    $("#" + tab.ButtonId, this.getContext()).addClass("tws-active-tab-button");
};

Sage.TabWorkspace.prototype.showMoreTab = function(tab, triggerUpdate) {
    this.logDebug("[enter] showMoreTab");
    
    if (typeof tab === "string")
        tab = this.getInfoFor(tab);
    
    if (this.getState().getActiveMoreTab() == tab.Id)
    {
        //still optionally trigger an update
        if (typeof triggerUpdate == 'undefined' || triggerUpdate)
            this.triggerUpdateFor(tab.Id); 
        return;   
    }
    
    this.getState().setActiveMoreTab(tab.Id);
    
    
    
    this.showMoreTabDom(tab);
    
    if (typeof triggerUpdate == 'undefined' || triggerUpdate)
            this.triggerUpdateFor(tab.Id); 
            
    this.fireEvent('moretabchange', tab.Id, tab);
};

Sage.TabWorkspace.prototype.showMoreTabDom = function(tab) {
    if (typeof tab === "string")
        tab = this.getInfoFor(tab);
    
    $(".tws-more-tab-content .tws-tab-element", this.getContext()).hide();
    $("#" + tab.ElementId, this.getContext()).show();
    $(".tws-more-tab-buttons .tws-more-tab-button", this.getContext()).removeClass("tws-active-more-tab-button");
    $("#" + tab.MoreButtonId, this.getContext()).addClass("tws-active-more-tab-button");
};

Sage.TabWorkspace.prototype.dropToMainSection = function(tab, target) {   
    
    
    this.logDebug("[enter] dropToMainSection");
      
    //determine the drop position via ui.droppable
    var $location;
    if ($(target).is(".tws-main-tab-buttons"))    
        $location = $(".tws-tab-button-tail", this.getContext());    
    else    
        $location = $(target, this.getContext());
                             
    switch (this.getState().getSectionFor(tab.Id))
    {
        case Sage.TabWorkspaceState.MAIN_TABS:                   
            $location.before($("#" + tab.ButtonId, this.getContext()));
            break;
            
        case Sage.TabWorkspaceState.MORE_TABS:
            $("#" + tab.MoreButtonId, this.getContext()).hide();
            $location.before($("#" + tab.ButtonId, this.getContext()).show());            
            
            //move the tab element
            $(".tws-main-tab-content", this.getContext()).append($("#" + tab.ElementId));
            //move the drop target
            $(".tws-main-tab-content", this.getContext()).append($("#" + tab.DropTargetId));
            break;
            
        case Sage.TabWorkspaceState.MIDDLE_TABS:                 
            $location.before($("#" + tab.ButtonId, this.getContext()).show());
            
            //move the tab element
            $(".tws-main-tab-content", this.getContext()).append($("#" + tab.ElementId));
            //move the drop target
            $(".tws-main-tab-content", this.getContext()).append($("#" + tab.DropTargetId));
            
            break;
    }
       
    //add this tab to the main tabs
    if ($location.is(".tws-tab-button-tail"))
        this.getState().addToMainTabs(tab.Id);
    else
        this.getState().addToMainTabs(tab.Id, this.getInfoForTabButton($location.attr("id")).Id, 0);    
        
    //show this main tab
    this.showMainTab(tab.Id);
};

Sage.TabWorkspace.prototype.dropToMoreSection = function(tab, target) {   
    
    
    this.logDebug("[enter] dropToMoreSection"); 
  
    //determine the drop position via ui.droppable
    var $location;
    if ($(target).is(".tws-more-tab-buttons"))    
        $location = $(".tws-more-tab-button-tail", this.getContext());    
    else    
        $location = $(target, this.getContext());
                             
    switch (this.getState().getSectionFor(tab.Id))
    {
        case Sage.TabWorkspaceState.MAIN_TABS:                   
            $("#" + tab.ButtonId, this.getContext()).hide();
            $location.before($("#" + tab.MoreButtonId, this.getContext()).show());            
            
            //move the tab element
            $(".tws-more-tab-element .tws-more-tab-content-fixer", this.getContext()).before($("#" + tab.ElementId));
            //move the drop target
            $(".tws-more-tab-element .tws-more-tab-content-fixer", this.getContext()).before($("#" + tab.DropTargetId));
            break;
            
        case Sage.TabWorkspaceState.MORE_TABS:
            $location.before($("#" + tab.MoreButtonId, this.getContext()));
            break;
            
        case Sage.TabWorkspaceState.MIDDLE_TABS:                 
            $location.before($("#" + tab.MoreButtonId, this.getContext()).show());
                        
            //move the tab element
            $(".tws-more-tab-element .tws-more-tab-content-fixer", this.getContext()).before($("#" + tab.ElementId));
            //move the drop target
            $(".tws-more-tab-element .tws-more-tab-content-fixer", this.getContext()).before($("#" + tab.DropTargetId));                        
            break;
    }
       
    //add this tab to the main tabs
    if ($location.is(".tws-more-tab-button-tail"))
        this.getState().addToMoreTabs(tab.Id);
    else
        this.getState().addToMoreTabs(tab.Id, this.getInfoForTabMoreButton($location.attr("id")).Id, 0);    
        
    //show this main tab
    this.showMoreTab(tab.Id);
};

Sage.TabWorkspace.prototype.dropToMiddleSection = function(tab, target) {   
    
    
    this.logDebug("[enter] dropToMiddleSection");
     
    var tabsToUpdate = [];
    
    //dropped to it's own drop target
    if (tab.DropTargetId == target.id)
        return;
             
    switch (this.getState().getSectionFor(tab.Id))
    {
        case Sage.TabWorkspaceState.MAIN_TABS:
            //are we the last main tab? if so, do nothing
            if (this.getState().getMainTabs().length == 1)
                return;
                
            //are we the current active main tab?
            if (this.getState().getActiveMainTab() == tab.Id)
            {
                var $newActiveTab = $("#" + tab.ButtonId, this.getContext()).prev(".tws-tab-button:visible:not(.tws-tab-button-tail)");
                if ($newActiveTab.length <= 0)
                    $newActiveTab = $("#" + tab.ButtonId, this.getContext()).next(".tws-tab-button:visible:not(.tws-tab-button-tail)");
                    
                if ($newActiveTab.length > 0)
                {
                    var newActiveTabId = this.getInfoForTabButton($newActiveTab.attr("id")).Id;
                    this.showMainTab(newActiveTabId, false); //do not trigger an update
                    tabsToUpdate.push(newActiveTabId);
                }                               
            }                      
            
            $("#" + tab.ButtonId, this.getContext()).hide();   
                
            //move the old drop target
            $(target).after($("#" + tab.DropTargetId, this.getContext()));    
            //show and move the tab element
            $(target).after($("#" + tab.ElementId, this.getContext()).show());
            
            tabsToUpdate.push(tab.Id);     
            break;
            
        case Sage.TabWorkspaceState.MORE_TABS:
            //are we the current active more tab?
            if (this.getState().getActiveMoreTab() == tab.Id)
            {
                //TODO: should we make a new more tab active?
            }
            
            $("#" + tab.MoreButtonId, this.getContext()).hide();
            
            //move the old drop target
            $(target).after($("#" + tab.DropTargetId, this.getContext()));    
            //show and move the tab element
            $(target).after($("#" + tab.ElementId, this.getContext()).show());
            
            tabsToUpdate.push(tab.Id);
            break;
            
        case Sage.TabWorkspaceState.MIDDLE_TABS:
            //move the old drop target
            $(target).after($("#" + tab.DropTargetId, this.getContext()));    
            //show and move the tab element
            $(target).after($("#" + tab.ElementId, this.getContext()).show());
            
            tabsToUpdate.push(tab.Id);
            break;
    }     
    
    //update state  
    if ($(target).hasClass("tws-middle-drop-target"))
        this.getState().addToMiddleTabs(tab.Id, 0); //first
    else  
        this.getState().addToMiddleTabs(tab.Id, this.getInfoForTabDropTarget(target.id).Id, 1);              
                    
    this.triggerUpdateFor(tabsToUpdate);
};

Sage.TabWorkspace.prototype.deriveStateFromMarkup = function() {
    var self = this;
    var state = { 
        MiddleTabs : [],
        MainTabs : [],
        MoreTabs : []        
    };
    
    $(".tws-middle-section .tws-tab-element", this.getContext()).each(function() {
        state.MiddleTabs.push(self.getInfoForTabElement($(this).attr("id")).Id);
    });
    
    $(".tws-main-section .tws-main-tab-buttons .tws-tab-button:visible", this.getContext()).each(function() { 
        var tab = self.getInfoForTabButton($(this).attr("id"));
        state.MainTabs.push(tab.Id);
        
        if ($(this).hasClass("tws-active-tab-button", this.getContext()))
            state.ActiveMainTab = tab.Id;
    });
    
    return state;
};


Sage.TabWorkspace.prototype.updateVisibleDroppables = function() {
    this.logDebug("[enter] enableAllVisibleDroppables");
    
    $("div.tws-drop-target:visible", this.getContext()).droppable("enable");   
    
    //fix for jQuery 1.5 and size of initially hidden droppables
    $.ui.ddmanager.prepareOffsets();

    this.logDebug("[leave] enableAllVisibleDroppables");
};

Sage.TabWorkspace.prototype.updateAllRegions = function() {
    this.updateMainAreaRegions();
    this.updateMoreAreaRegions();
    this.updateMiddleAreaRegions();
};

Sage.TabWorkspace.prototype.updateMainAreaRegions = function() { 
    //validate the container region and the area region list
    var region = this.createRegionsFrom(this._mainButtonContainer)[0];
        
    this._regions[Sage.TabWorkspace.MAIN_AREA] = this.createRegionsFrom(this._allMainButtons.filter(":visible")); 
    this._mainButtonContainerRegion = region;
};
Sage.TabWorkspace.prototype.updateMoreAreaRegions = function() {
    //validate the container region and the area region list
    var region = this.createRegionsFrom(this._moreButtonContainer)[0];
         
    this._regions[Sage.TabWorkspace.MORE_AREA] = this.createRegionsFrom(this._allMoreButtons.filter(":visible")); 
    this._moreButtonContainerRegion = region;
};
Sage.TabWorkspace.prototype.updateMiddleAreaRegions = function() { 
    this._regions[Sage.TabWorkspace.MIDDLE_AREA] = this.createRegionsFrom(this._allDropTargets.filter(":visible")); 
};

Sage.TabWorkspace.prototype.updateContextualFeedback = function() {
    
    if (this.getState().getMoreTabs().length <= 0)
        $(".tws-more-tab-message", this.getContext()).empty().append(TabWorkspaceResource.More_Tab_Empty_Message).show();
    else if (this.getState().getActiveMoreTab() == null) 
        $(".tws-more-tab-message", this.getContext()).empty().append(TabWorkspaceResource.More_Tab_No_Selection_Message).show();
    else
        $(".tws-more-tab-message", this.getContext()).hide();
        
    
    if (this.getState().getMiddleTabs().length <= 0)
    {
        $(".tws-middle-section", this.getContext()).addClass("tws-middle-section-empty");
        $(".tws-middle-drop-target span", this.getContext()).empty().append(TabWorkspaceResource.Middle_Pane_Empty_Drop_Target_Message);
    }
    else
    {
        $(".tws-middle-section", this.getContext()).removeClass("tws-middle-section-empty");
        $(".tws-middle-drop-target span", this.getContext()).empty().append(TabWorkspaceResource.Middle_Pane_Drop_Target_Message);
    }
};

Sage.TabWorkspace.prototype.triggerUpdateFor = function(tabs, data) {

    this.updateContextualFeedback();
    this.updateAllRegions(); 
    
    var tabsToUpdate = [];
    var shouldSendState = false;
    var stateSent = false;
    var self = this;
    
    if (typeof tabs == 'string')
    {
        //check to see if we need to update the tab.  never update the more tab, but do send state.
        if (tabs == Sage.TabWorkspace.MORE_TAB_ID)
        {
            //if we are the more tab, see if we need to update the active more tab
            var activeMoreTab = this.getState().getActiveMoreTab();
            if (activeMoreTab && !this.getState().wasTabUpdated(activeMoreTab))
            {
                this.getState().markTabUpdated(activeMoreTab);
                tabsToUpdate.push(activeMoreTab);
            }
            else
            {
                shouldSendState = true;
            }
        }
        else
        {        
            if (!this.getState().wasTabUpdated(tabs) && (tabs != Sage.TabWorkspace.MORE_TAB_ID))        
            {            
                //mark the tab as updated so when the state gets sent the server knows the control is "active"
                this.getState().markTabUpdated(tabs); 
                tabsToUpdate.push(tabs);            
            }
            else
            {
                shouldSendState = true;
            }
        }
    }
    else
    {
        for (var i = 0; i < tabs.length; i++)
        {
            //check to see if we need to update the tab.  never update the more tab, but do send state.
            if (tabs[i] == Sage.TabWorkspace.MORE_TAB_ID)
            {
                //if we are the more tab, see if we need to update the active more tab
                var activeMoreTab = this.getState().getActiveMoreTab();
                if (activeMoreTab && !this.getState().wasTabUpdated(activeMoreTab))
                {
                    this.getState().markTabUpdated(activeMoreTab);
                    tabsToUpdate.push(activeMoreTab);
                }
                else
                {
                    shouldSendState = true;
                }
            }
            else 
            {
                if (!this.getState().wasTabUpdated(tabs[i]) && (tabs[i] != Sage.TabWorkspace.MORE_TAB_ID))
                {
                    //mark the tab as updated so when the state gets sent the server knows the control is "active"
                    this.getState().markTabUpdated(tabs[i]); 
                    tabsToUpdate.push(tabs[i]);
                }
                else
                {
                    shouldSendState = true;
                }
            }
        }
    }
                
    if (typeof tabs == 'string')
        this.logDebug("Update requested for: " + tabs);
    else
        this.logDebug("Updates requested for: " + tabs.join(", "));
    
    var serializedState = this.getState().serialize();
    $("#" + this.getStateProxyPayloadId()).val(serializedState);
                            
    for (var i = 0; i < tabsToUpdate.length; i++)
    {
        this.logDebug("Triggering update for " + tabsToUpdate[i]);
    
        tab = tabsToUpdate[i];                                        
        //this.cleanupTabElement(tab);        
        
        $("#" + this.getInfoFor(tab).UpdatePayloadId).val(serializedState);
        __doPostBack(this.getInfoFor(tab).UpdateTriggerId, "");
        
        stateSent = true;              
    }
    
    var forceProxyCall = false;
    if (shouldSendState && !stateSent && this.getUseUIStateService())
    {    
        this.logDebug("Sending state update via UIStateService.");
                
        $.ajax({
            type: "POST",
            contentType: "application/json; charset=utf-8",
            url: "UIStateService.asmx/StoreTabWorkspaceState",
            data: Ext.util.JSON.encode({
                key: this.getUIStateServiceKey(),
                state: this.getState().getObject()
            }),
            dataType: "json",
            error: function (request, status, error) {
                self.logDebug("State update via UIStateService failed.");   
                self.logDebug("Sending state update via proxy.");
                        
                $("#" + self.getStateProxyPayloadId()).val(serializedState);
                __doPostBack(self.getStateProxyTriggerId(), ""); 
                
                stateSent = true;     
            },
            success: function(data, status) {
                stateSent = true;            
            }
        });
    }
    
    //if the state needs to be sent, and hasn't been, and the UI state service us not being used, or has failed
    //send it via the proxy
    if (shouldSendState && !stateSent && (!this.getUseUIStateService() || forceProxyCall))
    {
        this.logDebug("Sending state update via proxy.");
        
        //$("#" + this.getStateProxyPayloadId()).val(serializedState);
        __doPostBack(this.getStateProxyTriggerId(), "");
        
        stateSent = true;
    }    
};
Sage.TaskPaneItem = function(workspace, options) {
    this._workspace = workspace;
    this._options = options;
    this._events = {};
};

Sage.TaskPaneItem.prototype.getWorkspace = function() { return this._workspace; };
Sage.TaskPaneItem.prototype.getId = function() { return this._options.Id; };
Sage.TaskPaneItem.prototype.getClientId = function() { return this._options.ClientId; };
Sage.TaskPaneItem.prototype.getTitle = function() { return this._options.Title; };
Sage.TaskPaneItem.prototype.getDescription = function() { return this._options.Description; };
Sage.TaskPaneItem.prototype.getIsCollapsed = function() { return this._options.IsCollapsed; };
Sage.TaskPaneItem.prototype.setIsCollapsed = function(v) { this._options.IsCollapsed = v; };
Sage.TaskPaneItem.prototype.getElement = function() { return document.getElementById(this.getClientId()); };
Sage.TaskPaneItem.prototype.addListener = function(event, listener, context) {
    this._events[event] = this._events[event] || [];
    this._events[event].push({
        listener: listener,
        context: context
    });
};
Sage.TaskPaneItem.prototype.removeListener = function(event, listener, context) {
    if (this._events[event])
    {
        if (listener) 
        {
            for (var i = 0; i < this._events[event].length; i++)
                if (this._events[event][i].listener == listener)
                    break;
                
            this._listeners[event].splice(i, 1); //remove first
        }
        else
            this._listeners[event] = []; //remove all
    }    
};
Sage.TaskPaneItem.prototype.purgeListeners = function() {
    this._events = {};
};
Sage.TaskPaneItem.prototype.fireEvent = function(event, args) {
    if (this._events[event])
        for (var i = 0; i < this._events[event].length; i++)
            this._events[event][i].listener.apply(this._events[event][i].context || this._events[event][i].listener, args);  
};
Sage.TaskPaneItem.prototype.toggle = function() {
    var collapsed = this.getIsCollapsed();
    
    if (collapsed)
    {    
        $(this.getElement())
            .removeClass("task-pane-item-collapsed")
            .find(".task-pane-item-toggler")
            .attr("title", TaskPaneResources.Minimize)
            .find("img")
            .attr("src", this.getWorkspace().getOptions().MinimizeImage);               
        collapsed = false;
    }
    else
    {
        $(this.getElement())
            .addClass("task-pane-item-collapsed")
            .find(".task-pane-item-toggler")
            .attr("title", TaskPaneResources.Maximize)
            .find("img")
            .attr("src", this.getWorkspace().getOptions().MaximizeImage);
        collapsed = true;
    }
    
    this.fireEvent("toggled", [this, {collapsed: collapsed}]);
    
    //TODO: notify workspace of state change
    this.setIsCollapsed(collapsed);
    this.getWorkspace().persistState();
};

Sage.TaskPaneWorkspace = function(options) {
    this._options = options;  
    this._cache = {};
    this._items = [];    
    this._lookup = {
        byId: {},
        byClientId: {}
    };
    
    for (var i = 0; i < options.Items.length; i++)
    {
        var item = new Sage.TaskPaneItem(this, options.Items[i]);  
        this._lookup.byId[item.getId()] = item;
        this._lookup.byClientId[item.getClientId()] = item;
        
        this._items.push(item);
    }
    
    Sage.TaskPaneWorkspace.registerInstance({id: options.Id, clientId: options.ClientId}, this);
};

Sage.TaskPaneWorkspace.__instances = {byId: {}, byClientId: {}}; 
Sage.TaskPaneWorkspace.registerInstance = function(options, instance) { 
    Sage.TaskPaneWorkspace.__instances.byId[options.id] = instance;
    Sage.TaskPaneWorkspace.__instances.byClientId[options.clientId] = instance;   
}; 

Sage.TaskPaneWorkspace.getInstance = function(id) {
    return Sage.TaskPaneWorkspace.__instances.byId[id];  
};

Sage.TaskPaneWorkspace.getInstanceFromClientId = function(clientId) {
    return Sage.TaskPaneWorkspace.__instances.byClientId[clientId];
};

Sage.TaskPaneWorkspace.prototype.getId = function() { return this._options.Id; };
Sage.TaskPaneWorkspace.prototype.getClientId = function() { return this._options.ClientId; };
Sage.TaskPaneWorkspace.prototype.getUIStateServiceKey = function() { return this._options.UIStateServiceKey; };
Sage.TaskPaneWorkspace.prototype.getUIStateServiceProxyType = function() { return this._options.UIStateServiceProxyType; };
Sage.TaskPaneWorkspace.prototype.getOptions = function() { return this._options; };
Sage.TaskPaneWorkspace.prototype.getContext = function() { return this._context; };
Sage.TaskPaneWorkspace.prototype.getCache = function() { return this._cache; };
Sage.TaskPaneWorkspace.prototype.getItems = function() { return this._items; };
Sage.TaskPaneWorkspace.prototype.getItem = function(id) { return this._lookup.byId[id]; };
Sage.TaskPaneWorkspace.prototype.getItemFromClientId = function(id) { return this._lookup.byClientId[id]; };

Sage.TaskPaneWorkspace.prototype.initRequestManagerEvents = function() {
    var prm = Sys.WebForms.PageRequestManager.getInstance();
    prm.add_pageLoading(function(sender, args) {
        var panels = args.get_panelsUpdating();
        if (panels)
        {            
            for (var i = 0; i < panels.length; i++)
            {
                var $parent = $(panels[i]).parent(".task-pane");
                if ($parent.length > 0)
                {
                    var id = $parent.attr("id");
                    var instance = Sage.TaskPaneWorkspace.getInstanceFromClientId(id);
                    if (instance)
                    {
                        instance.purgeListeners();                        
                    }       
                }
            }            
        }
    });
    prm.add_pageLoaded(function(sender, args) {        
        var panels = args.get_panelsUpdated();
        if (panels)
        {            
            for (var i = 0; i < panels.length; i++)
            {
                var $parent = $(panels[i]).parent(".task-pane");
                if ($parent.length > 0)
                {
                    var id = $parent.attr("id");
                    var instance = Sage.TaskPaneWorkspace.getInstanceFromClientId(id);
                    if (instance)
                    {
                        instance.initContext();
                        instance.initCaches();
                        instance.initInteractions();
                        instance.updateVisualStyles();
                    }       
                }
            }            
        }
    });   
};

Sage.TaskPaneWorkspace.prototype.init = function() {
    var self = this;
    
    this.initRequestManagerEvents();
    this.initContext();
    this.initCaches();
    this.initInteractions();
        
    this.updateVisualStyles();  
};

Sage.TaskPaneWorkspace.prototype.purgeListeners = function() {
    for (var i = 0; i < this._items.length; i++)
        this._items[i].purgeListeners();
};

Sage.TaskPaneWorkspace.prototype.initContext = function() {
    if (document.getElementById)
        this._context = document.getElementById(this.getClientId());
};

Sage.TaskPaneWorkspace.prototype.initCaches = function() {
    this._cache.items = $(".task-pane-item:not(.ui-sortable-helper)", this._context);
    this._cache.headers = $(".task-pane-item-header:not(.ui-sortable-helper)", this._context);
};

Sage.TaskPaneWorkspace.prototype.initInteractions = function() {
    var self = this;
    
    jQuery.each(this.getItems(), function() {
        $(this.getElement()).find(".task-pane-item-toggler").bind("click", this, function(e) {
            e.data.toggle();
        });    
    });   
    
    
    var container = this.getOptions().SortDragContainer || $(this._context).parent().attr("id");    
    if (container)
        container = "#" + container;          
    else
        container = "parent";  
            
    if (this.getItems().length > 0)
    {
        $(".task-pane-item-container", this._context).sortable({
            axis: "y",
            items: ".task-pane-item",
            handle: ".task-pane-item-handle",
            revert: false,
            containment: container,
            helper: function(e, el) {
                var handle = $(el).find(".task-pane-item-handle");
                var clone = handle.clone()
                    .addClass("task-pane-drag-helper")
                    .css("width", handle.width() + "px");
                
                return clone.get(0);
            },
            delay: 50,
            scroll: true,
            update: function(e, ui) {
                self.initCaches(); //re-sync caches
                self.updateVisualStyles();
                self.persistState();
            }
        });
    }
};

Sage.TaskPaneWorkspace.prototype.updateVisualStyles = function() {
    //set first & last styling
    this._cache.items.removeClass("task-pane-item-first task-pane-item-last");
    this._cache.items.filter(":first").addClass("task-pane-item-first");
    this._cache.items.filter(":last").addClass("task-pane-item-last");
};

Sage.TaskPaneWorkspace.prototype.buildState = function() {
    var self = this;
    var state = {
        Order: [],
        Collapsed: []
    };
    this._cache.items.each(function() {
        var item = self.getItemFromClientId(this.id); 
        
        state.Order.push(item.getId());
        if ($(this).hasClass("task-pane-item-collapsed"))  
            state.Collapsed.push(item.getId());       
    });
    
    return state;
};

Sage.TaskPaneWorkspace.prototype.persistState = function() {
    $.ajax({
        type: "POST",
        contentType: "application/json; charset=utf-8",
        url: "UIStateService.asmx/StoreTaskPaneWorkspaceState",
        data: Ext.util.JSON.encode({
            key: this.getUIStateServiceKey(),
            state: this.buildState()
        }),
        dataType: "json",
        error: function (request, status, error) {            
        },
        success: function(data, status) {            
        }
    });
};

