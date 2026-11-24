import {readValue,writeValue} from "./persistence";
const prefix="ielts-reading-annotations-v1:";
export function getReadingAnnotations(articleId){const value=readValue(`${prefix}${articleId}`,[]);return Array.isArray(value)?value:[];}
export function saveReadingAnnotations(articleId,annotations){writeValue(`${prefix}${articleId}`,annotations);return annotations;}
