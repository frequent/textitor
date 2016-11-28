/**
 * JIO Github Storage Type = "git".
 * Git "filesystem" storage.
 */
/*global Blob, jIO, RSVP, Github*/
/*jslint nomen: true*/

(function (jIO, RSVP, Blob, Github) {
  "use strict";

  /**
   * The JIO Git Storage extension
   *
   * @class GitStorage
   * @constructor
   */
  function GitStorage () {}

  jIO.addStorage('git', GitStorage);

}(jIO, RSVP, Blob, Github));
