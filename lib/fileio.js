/*
Copyright (c) 2018-2023 Dave Weilert

Permission is hereby granted, free of charge, to any person obtaining a copy of this software 
and associated documentation files (the "Software"), to deal in the Software without restriction, 
including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, 
and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, 
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial 
portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT 
LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. 
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, 
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE 
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/*------------------------------------------------------------------------------
Component that reads, parses, and stores the yaml file information.
*/
'use strict';

import vpk from '../lib/vpk.js';
import utl from '../lib/utl.js';
import afterParse from '../lib/afterParse.js';
import controllerRevisionParse from '../lib/parseControllerRevision.js';
import csiParse from '../lib/parseCSI.js';
import crdParse from '../lib/parseCRD.js';
import endpointsParse from '../lib/parseEndpoints.js';
import endpointSliceParse from '../lib/parseEndpointSlice.js';
import eventParse from '../lib/parseEvent.js';
import genericParse from '../lib/parseGeneric.js';
import hpaParse from '../lib/parseHPA.js';
import nodeParse from '../lib/parseNode.js';
import persistentVolumeParse from '../lib/parsePersistentVolume.js';
import persistentVolumeClaimParse from '../lib/parsePersistentVolumeClaim.js';
import roleBindingParse from '../lib/parseBinding.js';
import roleParse from '../lib/parseRole.js';
import secretParse from '../lib/parseSecret.js';
import serviceParse from '../lib/parseService.js';
import serviceAccountParse from '../lib/parseServiceAccount.js';
import storageClassParse from '../lib/parseStorageClass.js';
import timeParse from '../lib/parseTimes.js';
import volumeAttachment from '../lib/parseVolumeAttachment.js';
import workloadParse from '../lib/parseWorkload.js';
import lbl from '../lib/labels.js';
import anno from '../lib/annotations.js';

import oRefBld from '../lib/ownerRefBuild.js';
import owner from '../lib/ownerRef.js';

var fnum;
var oRef;
var cStatus;
var statusPhase = '';
var statusTypes = {};

//------------------------------------------------------------------------------
// process the vpk.k8sResc object to parse the defitions 
//------------------------------------------------------------------------------

function loadResources(client) {
    vpk.childUids = [];
    let keys = Object.keys(vpk.k8sResc);
    let key;
    let k;
    let contents;
    let hl = vpk.k8sResc.length;
    let increment = Math.round(hl / 5);
    var nowCnt = 0;
    var msg;

    //clear vpk
    delete vpk.relMap
    vpk.relMap = '';

    try {
        for (k = 0; k < keys.length; k++) {
            nowCnt++;
            if (nowCnt >= increment) {
                nowCnt = 0;
                msg = 'Progress - parsed files: ' + i + ' of ' + hl;
                client.emit('parseStatus', { 'msg': msg });
                utl.logMsg('vpkFIO021 - ' + msg);
            }
            key = parseInt(keys[k])
            contents = vpk.k8sResc[key]
            vpk.yaml = contents;
            processYAML(keys[k], '');
        }
    } catch (err) {
        utl.logMsg('vpkFIO001 - Skipped, unable to parse key: ' + keys[k] + ' Error: ' + err);
    }
    vpk.baseFS = [];
    vpk.uid = [];
}

//------------------------------------------------------------------------------
// using yamljs read and parse the file
//------------------------------------------------------------------------------
function processYAML(fn, part) {
    var valid = true; // indicate if yaml is valid, true = yes, false = no
    var y_ns = '';
    var y_kind = '';
    var y_name = '';
    var y_node = '';
    let netKey;
    let netInfo;
    //    fnum = fn + '.' + part
    fnum = fn;


    try {
        // determine if this is a valid kubernetes yaml file			
        if (typeof vpk.yaml !== 'undefined') {
            if (typeof vpk.yaml.apiVersion !== 'undefined') {
                // Handle one off processing for specific KINDS
                if (typeof vpk.yaml.kind !== 'undefined') {
                    y_kind = vpk.yaml.kind;
                    // Save Namespace fnum
                    if (y_kind === "Namespace") {
                        if (typeof vpk.namespaceFnum[vpk.yaml.metadata.name] === 'undefined') {
                            vpk.namespaceFnum[vpk.yaml.metadata.name] = fnum
                        }
                    }
                    // Save Ingress fnum and yaml
                    if (y_kind === "Ingress") {
                        vpk.ingress.push({ 'fnum': fnum, 'def': vpk.yaml })
                        // Network related info saved
                        netKey = y_kind + ':cluster-level:' + vpk.yaml.metadata.name;
                        netInfo = {};
                        netInfo.fnum = fnum;
                        netInfo.obj = vpk.yaml;
                        if (typeof vpk.netInfo[netKey] === 'undefined') {
                            vpk.netInfo[netKey] = netInfo;
                        }
                    }

                    // Save IngressClass fnum and yaml
                    if (y_kind === "IngressClass") {
                        vpk.ingressClass.push({ 'fnum': fnum, 'def': vpk.yaml })
                        // Network related info saved
                        netKey = y_kind + ':cluster-level:' + vpk.yaml.metadata.name;
                        netInfo = {};
                        netInfo.fnum = fnum;
                        netInfo.obj = vpk.yaml;
                        if (typeof vpk.netInfo[netKey] === 'undefined') {
                            vpk.netInfo[netKey] = netInfo;
                        }
                    }

                    // Save IngressController fnum and yaml
                    if (y_kind === "IngressController") {
                        vpk.ingressController.push({ 'fnum': fnum, 'def': vpk.yaml })
                        // Network related info saved
                        netKey = y_kind + ':cluster-level:' + vpk.yaml.metadata.name;
                        netInfo = {};
                        netInfo.fnum = fnum;
                        netInfo.obj = vpk.yaml;
                        if (typeof vpk.netInfo[netKey] === 'undefined') {
                            vpk.netInfo[netKey] = netInfo;
                        }
                    }

                } else {
                    valid = false;
                }
            } else {
                valid = false;
            }
        }

        // check if metadata tag is found and get the name
        if (valid) {
            if (typeof vpk.yaml.metadata !== 'undefined') {
                if (typeof vpk.yaml.metadata.name !== 'undefined') {
                    y_name = vpk.yaml.metadata.name;
                } else {
                    valid = false;
                    utl.logMsg('vpkFIO036 - Missing metadata.name for kind: ' + y_kind + ' fnum: ' + fnum);
                }
            }
        }


        // set namespace 
        if (typeof vpk.yaml.metadata.namespace !== 'undefined') {
            y_ns = vpk.yaml.metadata.namespace;
        } else {
            // no namespace defined, will treat as cluster level resource
            y_ns = 'cluster-level';
        }

        var comboKey = vpk.yaml.apiVersion + ':' + vpk.yaml.kind;
        if (typeof vpk.apitypes[comboKey] === 'undefined') {
            var atype = {};
            atype.group = vpk.yaml.apiVersion;
            atype.kind = vpk.yaml.kind;
            atype.namespaced = y_ns;
            vpk.apitypes[comboKey] = atype;
        }

        // if valid yaml 
        if (valid) {
            if (typeof vpk.kindNSName[y_kind + '.' + y_ns + '.' + y_name] === 'undefined') {
                vpk.kindNSName[y_kind + '.' + y_ns + '.' + y_name] = [];
            }
            vpk.kindNSName[y_kind + '.' + y_ns + '.' + y_name].push(fnum)

            // Check if Secret redact should occur
            if (y_kind === 'Secret') {
                if (vpk.configFile.defaults.redactSecrets === true) {
                    vpk.yaml = utl.redactSecret(vpk.yaml);
                }
            }

            // check if yaml status should be dropped
            if (vpk.dropStatus) {
                if (y_kind === 'Pod') {
                    if (typeof vpk.yaml.status !== 'undefined') {
                        cStatus = vpk.yaml.status
                        if (typeof vpk.yaml.status.phase !== 'undefined') {
                            statusPhase = vpk.yaml.status.phase;
                            if (typeof vpk.podStatus[fnum] === 'undefined') {
                                vpk.podStatus[fnum] = { 'status': statusPhase, 'cnt': 1 };
                            } else {
                                vpk.podStatus[fnum].cnt = vpk.podStatus[fnum].cnt + 1;
                            }
                            if (typeof vpk.stats['pods'] === 'undefined') {
                                vpk.stats['pods'] = {};
                            }
                            if (typeof vpk.stats['pods'][statusPhase] === 'undefined') {
                                vpk.stats['pods'][statusPhase] = { 'cnt': 0 };
                            }
                            vpk.stats['pods'][statusPhase].cnt = vpk.stats['pods'][statusPhase].cnt + 1;
                            let x = 'x';

                        }
                    } else {
                        cStatus = {};
                    }
                }
            }

            // set node
            if (typeof vpk.yaml.spec !== 'undefined') {
                if (typeof vpk.yaml.spec.nodeName !== 'undefined') {
                    y_node = vpk.yaml.spec.nodeName;
                } else {
                    // no namespace defined, will treat as cluster level resource
                    y_node = 'unknown';
                }
            } else {
                y_node = 'unknown';
            }

            if (y_kind === 'Pod') {
                timeParse.checkPod(y_ns, y_kind, y_name, vpk.yaml, fnum);
            }

            if (y_kind === 'Node' || y_kind === 'PersistentVolumeClaim' ||
                y_kind === 'PersistentVolume' || y_kind === 'StorageClass' ||
                y_kind === 'IngressClass' || y_kind === 'Ingress' || y_kind === 'IngressController' ||
                y_kind === 'Service' || y_kind === 'Endpoints' ||
                y_kind === 'EndpointSlice' || y_kind === 'CSINode') {
                timeParse.checkCreateTime(y_ns, y_kind, y_name, vpk.yaml, fnum);
            }



            //==================================================//
            // Build index like entires for this resource       //
            //==================================================//


            // Add to located list of namespaces
            utl.checkDefinedNamespace(y_ns);

            // Check the kind definition 
            utl.checkKind(y_kind);

            // Namespace, Kind, Name, Fnum array
            vpk.allKeys.push(
                {
                    'apiVersion': vpk.yaml.apiVersion,
                    'namespace': vpk.yaml.metadata.namespace,
                    'kind': vpk.yaml.kind,
                    'name': vpk.yaml.metadata.name,
                    'fnum': fnum
                }
            );

            // Check for Helm chart managed Resource
            if (typeof vpk.yaml.metadata.labels !== 'undefined') {
                if (typeof vpk.yaml.metadata.labels['app.kubernetes.io/managed-by'] !== 'undefined') {
                    if (typeof vpk.yaml.metadata.labels['app.kubernetes.io/managed-by'] !== 'undefined') {
                        if (vpk.yaml.metadata.labels['app.kubernetes.io/managed-by'] === 'Helm') {
                            let helmChart = 'na';
                            if (typeof vpk.yaml.metadata.labels['chart'] !== 'undefined') {
                                helmChart = vpk.yaml.metadata.labels['chart'];
                            } else if (typeof vpk.yaml.metadata.labels['helm.sh/chart'] !== 'undefined') {
                                helmChart = vpk.yaml.metadata.labels['helm.sh/chart'];
                            }
                            if (typeof vpk.helm[helmChart] === 'undefined') {
                                vpk.helm[helmChart] = [];
                            }
                            vpk.helm[helmChart].push({ 'chart': helmChart, 'fnum': fnum, 'kind': y_kind, 'ns': y_ns, 'name': y_name });
                        } else if (vpk.yaml.metadata.labels['app.kubernetes.io/managed-by'] === 'operator') {
                            vpk.operator.push({ 'fnum': fnum, 'kind': y_kind, 'ns': y_ns, 'name': y_name });
                        } else {
                            // console.log(`manged-by: ${vpk.yaml.metadata.labels['app.kubernetes.io/managed-by']}`)
                        }
                    }
                }
            }

            // UID 
            if (typeof vpk.allUids[vpk.yaml.metadata.uid] === 'undefined') {
                if (typeof vpk.yaml.metadata.uid !== 'undefined') {
                    vpk.allUids[vpk.yaml.metadata.uid] = {
                        'fnum': fnum,
                        'namespace': vpk.yaml.metadata.namespace,
                        'kind': vpk.yaml.kind,
                        'name': vpk.yaml.metadata.name,
                        'api': vpk.yaml.apiVersion
                    }
                } else {
                    vpk.allUids[fn] = {     // no system uid, using generated id
                        'fnum': fnum,
                        'namespace': vpk.yaml.metadata.namespace,
                        'kind': vpk.yaml.kind,
                        'name': vpk.yaml.metadata.name,
                        'api': vpk.yaml.apiVersion
                    };
                }
            }

            // If Pod then special handling
            if (y_kind === 'Pod') {
                if (typeof vpk.podList[fnum] === 'undefined') {
                    vpk.podList[fnum] = { 'fnum': fnum, 'namespace': y_ns };

                    if (typeof vpk.yaml.metadata.ownerReferences !== 'undefined') {
                        vpk.podList[fnum].owners = vpk.yaml.metadata.ownerReferences;

                        if (typeof vpk.yaml.metadata.ownerReferences[0].kind !== 'undefined') {
                            if (vpk.yaml.metadata.ownerReferences[0].kind === 'DaemonSet') {
                                if (typeof vpk.daemonSetPods[fnum] === 'undefined') {
                                    vpk.daemonSetPods.push(fnum);
                                }
                            }
                        }
                    }
                }
            }

            // check if metadata.annotations exists
            if (typeof vpk.yaml.metadata !== 'undefined') {
                if (typeof vpk.yaml.metadata.annotations !== 'undefined') {
                    anno.checkAnnotations(vpk.yaml.metadata.annotations, fnum)
                }
            }

            // check metadata.labels exists
            if (typeof vpk.yaml.metadata !== 'undefined') {
                if (typeof vpk.yaml.metadata.labels !== 'undefined') {
                    lbl.checkLabels(y_ns, 'Labels', y_name, vpk.yaml.metadata, fnum);
                }
            }

            // check spec.template labels exist
            if (typeof vpk.yaml.spec !== 'undefined' && vpk.yaml.spec !== null) {
                if (typeof vpk.yaml.spec.template !== 'undefined') {
                    if (typeof vpk.yaml.spec.template.metadata !== 'undefined') {
                        lbl.checkLabels(y_ns, 'PodLabels', y_name, vpk.yaml.spec.template.metadata, fnum);
                    }
                }
            }

            // check if spec.selector.matchLabels exist
            if (typeof vpk.yaml.spec !== 'undefined' && vpk.yaml.spec !== null) {
                if (typeof vpk.yaml.spec.selector !== 'undefined') {
                    if (typeof vpk.yaml.spec.selector.matchLabels !== 'undefined') {
                        lbl.checkMatchLabels(y_ns, 'MatchLabels', y_name, vpk.yaml.spec.selector.matchLabels, fnum);
                    }
                }
            }

            //ToDo: does checkOwnerReferences need to deal with multiple containers
            oRef = oRefBld.checkOwnerReferences(y_name, y_ns, fnum);

            // OwnerRef structure
            if (typeof vpk.yaml.metadata.ownerReferences !== 'undefined') {
                let pKind;
                let pName;
                let key;
                if (typeof vpk.yaml.metadata.uid !== 'undefined') {
                    key = vpk.yaml.metadata.uid
                } else {
                    utl.logMsg(`vpkFIO444 - No UID for kind:${y_kind}  namespace:${y_ns}  name:${y_name}`)
                    key = fnum
                }
                for (let i = 0; i < vpk.yaml.metadata.ownerReferences.length; i++) {
                    // Use temp vars in case the ownerReference is missing 
                    // the parent name or kind
                    if (typeof vpk.yaml.metadata.ownerReferences[i].kind !== 'undefined') {
                        pKind = vpk.yaml.metadata.ownerReferences[i].kind
                    } else {
                        pKind = 'unknown';
                    }
                    if (typeof vpk.yaml.metadata.ownerReferences[i].name !== 'undefined') {
                        pName = vpk.yaml.metadata.ownerReferences[i].name
                    } else {
                        pName = 'unknown';
                    }
                    vpk.oRefLinks.push(
                        {
                            'child': key,
                            'childFnum': fnum,
                            'childKind': y_kind,
                            'childName': y_name,
                            'ns': y_ns,
                            'parent': vpk.yaml.metadata.ownerReferences[i].uid,
                            'parentFnum': '',   // Updated in the afterParse.js 
                            'parentKind': pKind,
                            'parentName': pName
                        }
                    );
                }
            }

            buildIndexes(fnum, y_kind, y_ns, y_name)

            // increment counter
            vpk.yCnt++;

            //
            if (typeof y_ns === 'undefined' || y_ns === null || y_ns === '') {
                utl.count(y_kind, 'cluster-level', y_name)
            } else {
                utl.count(y_kind, y_ns, y_name);
            }

            // check if Services should be run through generic
            genericParse.parse(y_ns, y_kind, y_name, fnum);

            // parse and populate
            switch (y_kind) {
                case 'ClusterRole':
                    roleParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'ClusterRoleBinding':
                    roleBindingParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'ControllerRevision':
                    controllerRevisionParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'CronJob':
                    processContainer(y_ns, y_kind, y_name, fn, part, y_node);
                    break;
                case 'CSIDriver':
                    csiParse.parse(y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'CSINode':
                    csiParse.parse(y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'CustomResourceDefinition':
                    crdParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'DaemonSet':
                    processContainer(y_ns, y_kind, y_name, fn, part, y_node);
                    break;
                case 'Deployment':
                    //(ns, kind, name, obj, containerType, fnum)
                    processContainer(y_ns, y_kind, y_name, fn, part, y_node);
                    break;
                case 'Endpoints':
                    endpointsParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'EndpointSlice':
                    endpointSliceParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'Event':
                    eventParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'HorizontalPodAutoscaler':
                    hpaParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'Job':
                    processContainer(y_ns, y_kind, y_name, fn, part, y_node);
                    break;
                case 'Node':
                    nodeParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'PersistentVolume':
                    persistentVolumeParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'PersistentVolumeClaim':
                    persistentVolumeClaimParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'Pod':
                    // Save network realted information
                    let netWrite = false;
                    let netInfo = {};
                    // populate network info
                    if (typeof vpk.yaml.spec.hostNetwork !== 'undefined') {
                        netInfo.hostNetwork = vpk.yaml.spec.hostNetwork;
                        netWrite = true;
                    } else {
                        netInfo.hostNetwork = false;
                        netWrite = true;
                    }

                    if (typeof vpk.yaml.status.podIP !== 'undefined') {
                        netInfo['podIP'] = vpk.yaml.status.podIP
                        netWrite = true;
                    }
                    if (typeof vpk.yaml.status.podIPs !== 'undefined') {
                        netInfo.podIPs = vpk.yaml.status.podIPs
                        netWrite = true;
                    }
                    if (typeof vpk.yaml.status.qosClass !== 'undefined') {
                        netInfo.qosClass = vpk.yaml.status.qosClass
                        netWrite = true;
                    }
                    if (netWrite === true) {
                        netInfo.fnum = fnum;
                        netInfo.nodeName = y_node;
                        let netKey = y_kind + ':' + y_ns + ':' + y_name;
                        if (typeof vpk.netInfo[netKey] === 'undefined') {
                            vpk.netInfo[netKey] = netInfo;
                        } else {
                            // console.log(JSON.stringify(vpk.netInfo[netKey], null, 4))
                            utl.logMsg(`vpkFIO26 - netInfo key: ${key} already exists`);
                        }
                    }
                    // Process the containers
                    processContainer(y_ns, y_kind, y_name, fn, part, y_node);
                    break;
                case 'ReplicaSet':
                    processContainer(y_ns, y_kind, y_name, fn, part, y_node);
                    break;
                case 'ReplicationController':
                    processContainer(y_ns, y_kind, y_name, fn, part, y_node);
                    break;
                case 'Role':
                    roleParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'RoleBinding':
                    roleBindingParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'Secret':
                    secretParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'Service':
                    serviceParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'ServiceAccount':
                    serviceAccountParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'StatefulSet':
                    processContainer(y_ns, y_kind, y_name, fn, part, y_node);
                    break;
                case 'StorageClass':
                    storageClassParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum);
                    break;
                case 'VolumeAttachment':
                    volumeAttachment.parse(y_kind, y_name, vpk.yaml, fnum)
                    break;
                default:
                    if (typeof vpk.yaml.spec !== 'undefined') {
                        if (vpk.yaml.spec !== null) {
                            if (typeof vpk.yaml.spec.containers !== 'undefined') {
                                processContainer(y_ns, y_kind, y_name, fn, part, y_node);
                            } else {
                                if (typeof vpk.yaml.spec.template !== 'undefined') {
                                    if (typeof vpk.yaml.spec.template.spec !== 'undefined') {
                                        if (typeof vpk.yaml.spec.template.spec.containers !== 'undefined') {
                                            processContainer(y_ns, y_kind, y_name, fn, part, y_node);
                                        }
                                    }
                                }
                            }
                        }
                    }
            }
        } else {
            // File skipped not valid for processing 
            // increment x counter, x = not Kube YAML
            vpk.xCnt++;
        }
    } catch (err) {
        utl.logMsg('vpkFIO005 - Error processing error file fnum: ' + fnum + ' message: ' + err.message);
        utl.logMsg('vpkFIO005 - stack: ' + err.stack);
        vpk.xCnt++;
    }
};

// workload processing logic
function processContainer(y_ns, y_kind, y_name, fn, part, y_node) {
    workloadParse.parse(y_ns, y_kind, y_name, vpk.yaml, fnum, y_node, fn, oRef, cStatus, statusPhase)
};


function buildIndexes(fnum, kind, ns, name) {
    //console.log(typeof (fnum))

    vpk.idxFnum[fnum] = { "ns": ns, "kind": kind, "name": name }

    if (typeof vpk.idxKind[kind] === 'undefined') {
        vpk.idxKind[kind] = []
    }
    vpk.idxKind[kind].push(fnum)

    if (typeof vpk.idxNS[ns] === 'undefined') {
        vpk.idxNS[ns] = []
    }
    vpk.idxNS[ns].push(fnum)

    if (typeof vpk.idxName[name] === 'undefined') {
        vpk.idxName[name] = []
    }
    vpk.idxName[name].push(fnum)

    if (typeof vpk.idxFullName[ns + '.' + kind + '.' + name] === 'undefined') {
        vpk.idxFullName[ns + '.' + kind + '.' + name] = []
    }
    vpk.idxFullName[ns + '.' + kind + '.' + name].push(fnum)
}

//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
export default {

    checkDir: function (client) {
        let tmp;
        try {

            let startT = utl.getPTime();
            loadResources();
            let stopT = utl.getPTime();
            utl.showTimeDiff(startT, stopT, 'fileio.loadResources();')

            startT = utl.getPTime();
            owner.chkUidChain();
            stopT = utl.getPTime();
            utl.showTimeDiff(startT, stopT, 'owner.chkUidChain();')

            afterParse.process(client);
        } catch (err) {
            utl.logMsg('vpkFIO129 - Error: ' + err);
            utl.logMsg('vpkFIO128 - Error: ' + err.stack);
        }
    }

};
