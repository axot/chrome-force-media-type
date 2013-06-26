/*!
 * Force Media-Type
 *
 * Copyright 2012, Ori Livneh
 * Licensed under the BSD license; see LICENSE for more details.
 */

/*jslint regexp: true, browser: true, maxerr: 50, indent: 4 */
/*global chrome: true */

(function () {
    "use strict";
    var headers_received = chrome.webRequest.onHeadersReceived,
        media_types = ['text/plain'],
        target_tab = 0,
        target_url = '',
        patch_headers = function (media_type) {
            var callback = function (details) {
                var headers = details.responseHeaders,
                    is_redirect = false;
                if (details.tabId === target_tab) {
                    // This is the request we want to intercept: the tab IDs
                    // and request URLs match.
                    var i=0;
                    var ctindex=0
                    headers.forEach(function (header) {
                        header.name = header.name.toLowerCase();
                        switch (header.name) {
                        case 'content-type':
                            ctindex = i;
                            break;
                        }
                        ++i;
                    });                    
                    var filext;
                    headers.forEach(function (header) {
                        switch (header.name) {
                        case 'content-disposition':
                            if(header.value.indexOf("filename") != -1){
                                filext = header.value.split('.').pop().replace(/["']/g, "");
                                if(filext) headers[ctindex].value = $.mime(filext);
                            }
                            header.value = '';
                            break;
                        case 'location':
                            is_redirect = true;
                            target_url = header.value;
                            break;
                        }
                    });
                    headers_received.removeListener(patch_headers);
                    // If it's a redirect, re-add a listener, specifying the
                    // new url as the url filter
                    if (is_redirect) {
                        headers_received.addListener(
                            patch_headers(media_type),
                            {urls: [target_url]},
                            ['blocking', 'responseHeaders']
                        );
                    }
                }
                return {responseHeaders: headers};
            };
            return callback;
        },
        click_handler = function (media_type) {
            // Handle a context menu item click
            var handler = function (info) {
                // Open the requested url in a new tab
                target_url = info.linkUrl;
                headers_received.addListener(
                    patch_headers(media_type),
                    {urls: [target_url]},
                    ['blocking', 'responseHeaders']
                );
                chrome.tabs.create({url: target_url}, function (tab) {
                    target_tab = tab.id;
                });
            };
            return handler;
        },
        uniquify = function (array) {
            // Remove duplicate items from array
            return array.filter(function (val, i) {
                return i === array.indexOf(val);
            });
        },
        build_menus = function () {
            // Create right-click context menu items
            var extra_types = (localStorage.extra_types || '').split('\n'),
                types = uniquify(media_types.concat(extra_types)),
                parent_id,
                nonempty = function (string) {
                    return (/[^\s]/).test(string);
                };

            // Strip blanks by searching for values that have no non-whitespace
            // characters.
            types = types.filter(nonempty);

            // Create the parent
//            parent_id = chrome.contextMenus.create({
//                title: "Open as media type\u2026",
//                contexts: ['link']
//            });

            // Create children
            types.forEach(function (media_type, index) {
                // Create at separator before user-set media types
//                if (index === media_types.length) {
//                    chrome.contextMenus.create({
//                        type: 'separator',
//                        contexts: ['link'],
//                        parentId: parent_id
//                    });
//                }
                // Create the menu item for this type
                chrome.contextMenus.create({
                    title: 'Open inside',
                    contexts: ['link'],
                    onclick: click_handler(media_type)
                });
            });
        },
        options_updated_handler = function (e) {
            // Listen to StorageEvents and update menus as necessary
            if (e.key === 'extra_types' && e.newValue !== e.oldValue) {
                chrome.contextMenus.removeAll(build_menus);
            }
        };
    build_menus();
    window.addEventListener('storage', options_updated_handler);
}());
