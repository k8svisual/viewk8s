/*
Copyright (c) 2018-2023 k8sVisual

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
Called from fileio.js to process annotations;  
*/

'use strict';

import vpk from './vpk.js';
import utl from './utl.js';

//------------------------------------------------------------------------------
// common routines
//------------------------------------------------------------------------------
export default {
    //------------------------------------------------------------------------------
    // metadata.annotations
    //------------------------------------------------------------------------------
    checkAnnotations: function (annotations, fnum) {
        try {
            // grab labels if they exist
            if (typeof annotations !== 'undefined') {
                for (var key in annotations) {
                    var value = annotations[key];
                    // Save key    
                    if (typeof vpk.idxAnnotations[key] === 'undefined') {
                        vpk.idxAnnotations[key] = []
                        vpk.idxAnnotations[key].push(fnum)
                    } else {
                        vpk.idxAnnotations[key].push(fnum)
                    }
                    // Save value
                    if (typeof vpk.idxAnnotationsValue[value] === 'undefined') {
                        vpk.idxAnnotationsValue[value] = []
                        vpk.idxAnnotationsValue[value].push(fnum)
                    } else {
                        vpk.idxAnnotationsValue[value].push(fnum)
                    }
                }
            }
        } catch (err) {
            utl.logMsg('vpkLBL555 - Error processing file fnum: ' + fnum + ' message: ' + err);
            utl.logMsg('vpkLBL555 - Stack: ' + err.stack);
        }
    }
    //end of export    
};