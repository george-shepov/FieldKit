"use strict";

let elasticSearchUtils = {
    searchURL: "/wps/odx-common/content/search/",
    searchIndex: window.siteId + "." + OHIO.ODX.actions.getUserLanguageByCookie(),
    wcmURLPrefix: '/wps/wcm/connect/gov/',
    errorMessages: {
        'invalidResultSize':            'The resultSize parameter must be a number above 0',
        'invalidKeyword':               'The keyword setting must be a string',
        'invalidSiteArea':              'The siteArea parameter must be a WCM Path',
        'invalidPortalLocation':        'The portalLocation parameter must be a WCM Path',
        'invalidAuthoringTemplate':     'The authoringTemplate setting must be an array of strings',
        'invalidSortingField':          'The sorting field does not exist',
        'invalidSortingDirection':      'The sorting direction can only be ASC or DESC',
        'emptyQuery':                   'You must provide at least one query parameter: siteArea/portalLocation/authoringTemplate',
        'invalidSettings':              'Please try your search again with valid parameters',
        'noResults':                    'Your query returned no results, please try again with different parameters',
        'invalidDate' :                 'Please enter a valid date in YYYY/MM/DD format'
    },
    printMsg: function() {console.log("You're testing"); return true;},
    findContent: function( settings ) {
        return new Promise(function (resolve, reject) {
            if ( elasticSearchUtils.validateSettings( settings ) ) {
                let esAjaxQuery = elasticSearchUtils.getElasticSearchAjaxQuery( settings );
                $.ajax({
                    type:           "POST",
                    contentType:    "application/json",
                    url:            elasticSearchUtils.searchURL + elasticSearchUtils.searchIndex,
                    data:           JSON.stringify( esAjaxQuery ),
                    dataType:       "json",
                    success:        function ( results ) {
                                        if ( results.hits.hits.length > 0) {
                                            let data = elasticSearchUtils.formatResults( results, settings ),
                                                sortedData = elasticSearchUtils.sortResults( data, settings );
                                            console.log('Elastic Search Results: ', results);
                                            if ( sortedData.length > 0 ) {
                                                resolve( sortedData );
                                            }
                                            else {
                                                reject( elasticSearchUtils.errorMessages.noResults );
                                            }
                                            
                                        } else {
                                            reject( elasticSearchUtils.errorMessages.noResults );
                                        }
                                    },
                    error:          function ( error ) {
                                        reject( error );
                                    }
                });
            } else {
                reject( elasticSearchUtils.errorMessages.invalidSettings );
            }
        });
    },
    validateSettings: function ( settings ) {
        let validKeyword = true,
            validSiteArea = true,
            validPortalLocation = true,
            validAuthoringTemplate = true;

        if ( typeof settings.keyword !== 'undefined' ) {
            validKeyword = this.validateKeyword( settings.keyword, elasticSearchUtils.errorMessages.invalidKeyword );
        }
        if ( typeof settings.siteArea !== 'undefined' ) {
            validSiteArea = this.validateParameterIsPath( settings.siteArea, elasticSearchUtils.errorMessages.invalidSiteArea );
        }
        if ( typeof settings.portalLocation !== 'undefined' ) {
            validPortalLocation = this.validateParameterIsPath( settings.portalLocation, elasticSearchUtils.errorMessages.invalidPortalLocation );
        }
        if ( typeof settings.authoringTemplate !== 'undefined' ) {
            validAuthoringTemplate = this.validateAuthoringTemplate( settings.authoringTemplate, elasticSearchUtils.errorMessages.invalidAuthoringTemplate );
        }

        if ( typeof settings.keyword !== 'undefined' || typeof settings.siteArea !== 'undefined' || typeof settings.portalLocation !== 'undefined' || typeof settings.authoringTemplate !== 'undefined' ) {
            if ( validKeyword && validSiteArea && validPortalLocation && validAuthoringTemplate ) {
                return true
            } else {
                return false
            }
        } else {
            console.log ( elasticSearchUtils.errorMessages.emptyQuery );
            return false;
        }
    },
        validateKeyword: function ( keyword, errorMsg ) {
            if ( typeof keyword == 'string' ) {
                return true;
            } else {
                return false;
            }
        },
        validateParameterIsPath: function ( parameter, errorMsg ) {
            if ( typeof parameter == 'string' ) {
                if ( parameter.includes( '/' ) ) {
                    return true;
                } else {
                    console.log( errorMsg );
                    return false;
                }
                
            } else {
                console.log( errorMsg );
                return false;
            }
        },
        validateAuthoringTemplate: function ( authoringTemplate, errorMsg ) {
            if ( authoringTemplate.constructor === Array ) {
                authoringTemplate.forEach(function( item ) {
                    if ( typeof item !== 'string' ) {
                        console.log( errorMsg );
                        return false;
                    }
                });
                return true;
            } else {
                console.log( errorMsg );
                return false;
            }
        },
    getElasticSearchAjaxQuery: function ( settings ) {
        let esAjaxQuery = {
                from: 0,
                size: 100,
                query: {
                    bool: {
                        must: []
                    }
                }
            };
        if ( typeof settings.resultSize !== 'undefined' ) {
            if ( typeof settings.resultSize == 'number' ) {
                if ( settings.resultSize > 0 ) {
                    esAjaxQuery.size = settings.resultSize;
                } else {
                    console.log( elasticSearchUtils.errorMessages.invalidResultSize );
                }
            } else {
                console.log( elasticSearchUtils.errorMessages.invalidResultSize );
            }
        }
        if ( typeof settings.keyword !== 'undefined' ) {
            esAjaxQuery.query.bool.must.push(
                {
                    query_string : {
                        "query" : settings.keyword,
                        "fields" : [
                            "name",
                            "title",
                            "elements.summary",
                            "elements.body",
                            "description"
                        ]
                    }
                }
            );
        }
        if ( typeof settings.siteArea !== 'undefined' ) {
            esAjaxQuery.query.bool.must.push(
                {
                    match_phrase: {
                        "contentPath" : settings.siteArea.split( '/gov' )[1]
                    }
                }
            );
        }
        if ( typeof settings.portalLocation !== 'undefined' ) {
            esAjaxQuery.query.bool.must.push(
                {
                    match_phrase_prefix: {
                        "elements.portalLocation" : settings.portalLocation
                    }
                }
            );
        }
        if ( typeof settings.authoringTemplate !== 'undefined' ) {
            esAjaxQuery.query.bool.must.push(
                {
                    match: {
                        "authoringTemplate" : elasticSearchUtils.formatAuthoringTemplateForESAjaxQuery( settings.authoringTemplate )
                    }
                }
            );
        }
        console.log("Elastic Search Query: ", esAjaxQuery );
        return esAjaxQuery;
    },
        formatAuthoringTemplateForESAjaxQuery: function ( authoringTemplates ) {
            let authoringTemplateArray = [];
            if ( authoringTemplates.length === 1) {
                return authoringTemplates[0].toLowerCase().replaceAll( ' ' , '-' );
            } else {
                authoringTemplates.forEach(function( authoringTemplate ) {
                    authoringTemplateArray.push(
                        authoringTemplate.toLowerCase().replaceAll( ' ' , '-' )
                    );
                });
                return '(' + authoringTemplateArray.join( ' or ' ) + ')';
            }
        },
    formatResults: function ( results, settings ) {
        var formatedResults = [];
        if ( results.hits.hits.length > 0 ) {
            results.hits.hits.forEach(function( element ) {
                let customElements = '';
                if ( typeof settings.showCustomElements !== 'undefined') {
                    if ( settings.showCustomElements ) {
                        customElements = element._source.elements;
                    }
                }
                formatedResults.push({
                    uuid: element._id,
                    name: element._source.contentPath.split( "/" ).pop(),
                    title: element._source.title,
                    summary: element._source.elements.summary,
                    url: elasticSearchUtils.wcmURLPrefix + element._source.contentPath,
                    linkURLWebContent: element._source.elements.linkURL?
                        elasticSearchUtils.isWCMURL( element._source.elements.linkURL )
                        : "",
                    linkURLExternal: element._source.elements.overrideLinkURL == "Yes" ?
                        element._source.elements.linkURL
                        : "",
                    thumbnail: element._source.elements.thumbnail,
                    altThumbnail: "",
                    county: element._source.elements.county?
                        elasticSearchUtils.formatCounty( element._source.elements.county )
                        : "",
                    topics: element._source.elements.topics?
                        elasticSearchUtils.formatTopics( element._source.elements.topics )
                        : "",
                    startTimeWCM: element._source.authoringTemplate == "event" ?
                        elasticSearchUtils.formatDate( element._source.elements.startDateAndTime)
                        : elasticSearchUtils.formatDate( element._source.effectiveDate ),
                    endTimeWCM: element._source.authoringTemplate == "event" ?
                        elasticSearchUtils.formatDate( element._source.elements.endDateAndTime )
                        : elasticSearchUtils.formatDate( element._source.effectiveDate ),
                    customElements: customElements,
                    attachmentURL: element._source.elements.attachment,
                    attachmentDescription: element._source.elements.attachmentContentDescription ? 
                        element._source.elements.attachmentContentDescription : "",
                    contentType: element._source.elements.contentType?
                        elasticSearchUtils.formatContentType( element._source.elements.contentType)
                        : "",
                    contentPath: element._source.contentPath,
                    image: element._source.elements.image ? 
                        element._source.elements.image 
                        : "",
                    imageCaption: element._source.elements.imageCaption ? 
                        element._source.elements.imageCaption 
                        : "",
                });
            });
            if ( typeof settings.startDate !== 'undefined' || typeof settings.endDate !== 'undefined' ) {
                if ( this.validateDate( settings.startDate ) && this.validateDate( settings.endDate ) ) {
                    var startDateFilter = '',
                        endDateFilter = '',
                        dateCompliantResults = [];
                    if ( typeof settings.startDate !== 'undefined' ) {
                        startDateFilter = new Date(settings.startDate + ' 00:00:00 AM').getTime();
                    }
                    if ( typeof settings.endDate !== 'undefined' ) {
                        endDateFilter = new Date(settings.endDate + ' 11:59:59 PM').getTime();
                    }
                    dateCompliantResults = elasticSearchUtils.filterItemsByDate(formatedResults, startDateFilter, endDateFilter);
                    return dateCompliantResults;
                }
                else {
                    console.log( elasticSearchUtils.errorMessages.invalidDate);
                    return formatedResults;
                }
            }
            else {
                return formatedResults;
            }
        } else {
            console.log( elasticSearchUtils.errorMessages.noResults );
            return formatedResults;
        }
    },
    validateDate : function( date ) {
        if ( typeof date == 'undefined' ) {
            return true;
        }
        if ( typeof date == 'string' ) {
            if ( date.length == 10 ) {
                if ( moment( date )._isValid == true ) {
                    return true;
                }
            }
        }
        return false;
    },
    filterItemsByDate: function(items, startDateFilter, endDateFilter) {
        var filteredItems = items.filter( function ( item ) {
            var itemStartDate = new Date ( item.startTimeWCM ),
                itemEndDate = new Date ( item.endTimeWCM );
            if ( startDateFilter !== '' && endDateFilter !== '' ) {
                if ( itemEndDate >= startDateFilter && itemStartDate <= endDateFilter ) {
                    return item;
                }
            } else {
                if ( startDateFilter !== '' ) {
                    if ( itemEndDate >= startDateFilter ) {
                        return item;
                    }
                }
                if ( endDateFilter !== '' ) {
                    if ( itemStartDate <= endDateFilter ) {
                        return item;
                    }
                }
            }
        });
        return filteredItems;
    },
        isWCMURL: function ( url ) {
            if ( url.includes( 'wps/wcm' ) ) {
                return true;
            } else {
                return "";
            }
        },
        formatDate: function ( date ) {
            var formatedDate = moment( date ).format( 'YYYY/MM/DD' );
            return formatedDate;
        },
        formatCounty: function ( county ) {
            return county.split( "/" ).pop();
        },
        formatTopics: function ( topics ) {
            let topicsString = '',
                topicsArray = [];
            topics.split( '|' ).forEach(function( topic ) {
                topicsArray.push( topic.split( "/" ).pop() );
            });
            topicsString = topicsArray.join( ',' );
            return topicsString;
        },
        formatContentType: function ( contentType ) {
            return contentType.split( "/" ).pop();
        },
    sortResults: function ( results, settings ) {
        var sortField = false,
            sortDirection = false,
            sortedData = [];
        // if filter results are null (for event dates) then do not sort
    if(results.length > 0)     {
        if ( typeof settings.sortBy !== 'undefined' ) {
            if ( typeof settings.sortBy === 'string' ) {
                if ( settings.sortBy.length > 0 && typeof results[0][settings.sortBy] !== 'undefined' ) {
                    sortField = settings.sortBy;
                } else {
                    console.log( elasticSearchUtils.errorMessages.invalidSortingField );
                }
            } else {
                console.log( elasticSearchUtils.errorMessages.invalidSortingField );
            }
        }
        if ( typeof settings.sortDirection !== 'undefined' ) {
            if ( typeof settings.sortDirection === 'string' ) {
                if ( settings.sortDirection === 'ASC' || settings.sortDirection === 'DESC' ) {
                    sortDirection = settings.sortDirection;
                } else {
                    console.log( elasticSearchUtils.errorMessages.invalidSortingDirection );
                }
            } else {
                console.log( elasticSearchUtils.errorMessages.invalidSortingDirection );
            }
        }
        if ( sortField && sortDirection ) {
            results.sort( (a, b) => a[sortField].localeCompare( b[sortField] ) );
            if ( sortDirection === 'DESC' ) {
                results.reverse();
            }
        }
        return results;
    }
    else {
            console.log( elasticSearchUtils.errorMessages.invalidSettings );
            return results;
    }
    }
};

if ( typeof window.elasticSearchUtils === 'undefined' ) {
    window.elasticSearchUtils = elasticSearchUtils;
}