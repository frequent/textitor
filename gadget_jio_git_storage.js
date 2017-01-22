/**
 * JIO Github Storage Type = "git".
 * Git "filesystem" storage.
 */
/*global Blob, jIO, RSVP, Github*/
/*jslint nomen: true*/

// API https://github.com/michael/github > instructions
// Git commands: http://stackoverflow.com/questions/2745076/what-are-the-differences-between-git-commit-and-git-push?answertab=votes#tab-top

/*
             ->  add  ->  commit  ->   push
     workspace => index => local repo => remote repo
        <----------- pull/rebase ----------
                              <-- fetch ---
        <---- checkout HEAD --
        <- checkout -
        <------ diff HEAD ----
        <- diff -----

      memory  =>  sw    => git
      
 createJIO
  with url => fork
  without  => git init (make this a parameter?)
  
  remote?
  
  repair => push

  branches => caches or folders?
  easier to diff branch with folders/files or diff betweben folders?
  
      
- fork repo
- create repo
- delete repo
- push repo

- create branch
- switch branch
- remove branch

- open file       getAttachment
- create file     putAttachment
- add file        putAttachment
- commit file   
- remove file     removeAttachment



*/

(function (jIO, RSVP, Blob, Github) {
  "use strict";

  /**
   * The JIO Git Storage extension
   *
   * @class GitStorage
   * @constructor
   */
  function GitStorage () {}
  
  GitStorage.prototype.post = function () {};
  GitStorage.prototype.put = function () {};
  GitStorage.prototype.get = function () {};
  GitStorage.prototype.remove = function () {};
  GitStorage.prototype.allDocs = function () {};
  
  GitStorage.prototype.putAttachment = function () {};
  GitStorage.prototype.getAttachment = function () {};
  GitStorage.prototype.removeAttachment = function () {};
  GitStorage.prototype.allAttachment = function () {};
  
  GitStorage.prototype.buildQuery = function () {};
  GitStorage.prototype.hasCapacity = function () {};
  GitStorage.prototype.repair = function () {};

  jIO.addStorage('git', GitStorage);

}(jIO, RSVP, Blob, Github));
