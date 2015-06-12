/*! jquery.mentioner - v0.0.1 - 2015-06-12
* Copyright (c) 2015 MediaSQ; Licensed MIT */
(function ($) {
  'use strict';

  var KEYS = {
    ESC: 27,
    UP: 38,
    DOWN: 40,
    RETURN: 13
  };

  var MENTIONER_HOOK_CLASSES = {
    ROOT: 'js-mentioner-root',
    WRAPPER: 'js-mentioner-wrapper',
    DROPDOWN: 'js-mentioner-dropdown',
    DROPDOWN_ITEM: 'js-mentioner-dropdown-item'
  };

  var Mentioner = function($root, settings) {
    this.mentionSymbol = settings.mentionSymbol || '@';
    this.matcher = settings.matcher || $.noop;
    this.mentionables = (settings.requester ? settings.requester() : []).sort(function(prev, next){
      return prev.name.localeCompare(next.name);
    });

    this.buildDOM($root);
    this.attachEvents();
  };

  Mentioner.prototype.buildDOM = function($root) {
    var $parent = $( '<div class="' + MENTIONER_HOOK_CLASSES.WRAPPER + ' mentioner"></div>' );
    $root.wrap($parent);

    var $contentEditable = $( '<div class="' + MENTIONER_HOOK_CLASSES.ROOT + ' mentioner__composer" contenteditable="true"></div>' );
    $root.replaceWith($contentEditable);

    var $dropdown = $( '<ul class="' + MENTIONER_HOOK_CLASSES.DROPDOWN + ' mentioner__dropdown mentioner__dropdown--hidden dropdown"></ul>' );
    this.$parentWrapper().append($dropdown);
  };

  Mentioner.prototype.attachEvents = function() {
    /*
     * Not using Function.prototype.bind because of incompatibilities
     * with PhantomJS
     *
     * Related bug: https://github.com/ariya/phantomjs/issues/10522
     */
    this.$root().on('keydown', this.onRootKeydown());
    this.$root().on('input', this.onRootInput());
    this.$root().on('paste', this.onRootPaste());
  };

  Mentioner.prototype.onRootKeydown = function() {
    var that = this;

    var dropdownEventWrapper = function(callback) {
      if(that.isDropdownDisplayed()) {
        event.preventDefault();
        callback.call(that);
      }
    };

    return function(event) {
      switch (event.keyCode) {
        case KEYS.ESC:
          dropdownEventWrapper(function() {
            this.hideDropdown();
          });
          break;
        case KEYS.DOWN:
          dropdownEventWrapper(function() {
            this.selectOtherDropdownOption(function($selected) {
              return $selected.next().length === 0 ? $selected.siblings().first() : $selected.next();
            });
          });
        break;
        case KEYS.UP:
          dropdownEventWrapper(function() {
            this.selectOtherDropdownOption(function($selected) {
              return $selected.prev().length === 0 ? $selected.siblings().last() : $selected.prev();
            });
          });
        break;
        case KEYS.RETURN:
          dropdownEventWrapper($.noop);
        break;
        default:
          return true;
      }
    };
  };

  Mentioner.prototype.onRootInput = function() {
    var that = this;

    return function(event) {
      event.preventDefault();
      var text = that.$root().text();
      var lastMentionSymbolIndex = text.lastIndexOf(that.mentionSymbol);

      if(that.canBeSearchable(text, lastMentionSymbolIndex)) {
        var query = text.slice(lastMentionSymbolIndex + 1);
        that.search(query);
      } else {
        that.hideDropdown();
      }
    };
  };

  Mentioner.prototype.onRootPaste = function() {
    var that = this;

    return function(event) {
      event.preventDefault();

      var pastedData = event.originalEvent.clipboardData.getData('text/plain');

      var sanetizedHtml = pastedData.split("\n").map(function(line) {
        return line.trim() === "" ? '<div></div>' : '<div>' + line + '</div>';
      }).join('');

      that.addContentToRootHtml(sanetizedHtml);
    };
  };

  Mentioner.prototype.canBeSearchable = function(text, lastMentionSymbolIndex) {
    if(lastMentionSymbolIndex === -1) {
      return false;
    }

    var preMentionSymbolChar = text.charAt(lastMentionSymbolIndex - 1);
    var postMentionSymbolChar = text.charAt(lastMentionSymbolIndex  + 1);
    var isValidPreMentionSymbolChar = this.isValidPreMentionSymbolChar(preMentionSymbolChar);
    var isValidPostMentionSymbolChar = this.isValidPostMentionSymbolChar(postMentionSymbolChar);

    return isValidPreMentionSymbolChar && isValidPostMentionSymbolChar;
  };

  Mentioner.prototype.isValidPreMentionSymbolChar = function(preMentionSymbolChar) {
    // Prevent the dropdown to be shown when typing the mention symbol
    // after alphanumeric characters
    return !(/\w/g).test(preMentionSymbolChar);
  };

  Mentioner.prototype.isValidPostMentionSymbolChar = function(postMentionSymbolChar) {
    return postMentionSymbolChar !== " ";
  };

  Mentioner.prototype.search = function(query) {
    var that = this;

    var candidates = this.mentionables.filter(function(mentionable) {
      return that.matcher.call(that, mentionable, query);
    });

    if(candidates.length > 0) {
      this.showDropdown(candidates);
    } else {
      this.hideDropdown();
    }
  };

  Mentioner.prototype.$root = function() {
    return $( '.' + MENTIONER_HOOK_CLASSES.ROOT );
  };

  Mentioner.prototype.$parentWrapper = function() {
    return this.$root().parent();
  };

  Mentioner.prototype.addContentToRootHtml = function(html) {
    var oldRootHtml = this.$root().html();
    var newRootText = oldRootHtml + html;

    this.$root().html(newRootText);
  };

  Mentioner.prototype.getDropdown = function() {
    return this.$parentWrapper().find('.' + MENTIONER_HOOK_CLASSES.DROPDOWN);
  };

  Mentioner.prototype.getDropdownOptions = function() {
    return this.getDropdown().find('.' + MENTIONER_HOOK_CLASSES.DROPDOWN_ITEM);
  };

  Mentioner.prototype.showDropdown = function(candidates) {
    var $dropdownOptionsToAppend = this.getDropdownOptionsToAppend(candidates);

    var $dropdown = this.getDropdown();
    $dropdown.append($dropdownOptionsToAppend);
    $dropdown.attr('style', this.getStyleForDropdown());
    $dropdown.removeClass('mentioner__dropdown--hidden');

    this.removeOrphanDropdownOptions(candidates);
    this.checkSelectedDropdownOption();
  };

  Mentioner.prototype.getDropdownOptionsToAppend = function(candidates) {
    var that = this;
    return candidates.map(function(candidate) {
      var $relatedDropdownOption = that.getDropdownOptions().filter(function() {
        var mentionable = $(this).data('mentionable');

        return mentionable.id === candidate.id;
      });

      if($relatedDropdownOption.length !== 0) {
        return $relatedDropdownOption;
      } else {
        return that.createDropdownOption(candidate);
      }
    });
  };

  // Removes those old dropdown options which don't have a related candidate
  Mentioner.prototype.removeOrphanDropdownOptions = function(candidates) {
    this.getDropdownOptions().each(function() {
      var mentionable = $(this).data('mentionable');
      var candidate = candidates.filter(function(candidate) {
        return candidate.id === mentionable.id;
      })[0];

      if(!candidate) {
        $(this).remove();
      }
    });
  };

  Mentioner.prototype.createDropdownOption = function(mentionable) {
    var $item = $( '<li class="' + MENTIONER_HOOK_CLASSES.DROPDOWN_ITEM + ' dropdown__item"></li>' );
    var $name = $( '<p class="dropdown__item__name">' + mentionable.name + '</p>' );
    var $avatar = $([
      '<div class="dropdown__item__avatar">',
        '<img class="dropdown__item__avatar__image" src="' + mentionable.avatar + '" />',
      '</div>'
    ].join("\n"));

    $item.append($avatar);
    $item.append($name);
    $item.data('mentionable', mentionable);

    return $item;
  };

  Mentioner.prototype.checkSelectedDropdownOption = function() {
    var $selected = this.getSelectedDropdownOption();

    if($selected.length === 0) {
      var $oldSelected = $();
      var $newSelected = this.getDropdownOptions().first();

      this.selectDropdownOption($oldSelected, $newSelected);
    }
  };

  Mentioner.prototype.getSelectedDropdownOption = function() {
    return $( '.dropdown__item--selected' );
  };

  Mentioner.prototype.getStyleForDropdown = function() {
    var top = this.$root().outerHeight() - 3;

    return 'top: ' + top + 'px;';
  };

  Mentioner.prototype.hideDropdown = function() {
    var $dropdown = this.getDropdown();
    $dropdown.addClass('mentioner__dropdown--hidden');
  };

  Mentioner.prototype.isDropdownDisplayed = function() {
    return !this.getDropdown().hasClass('mentioner__dropdown--hidden');
  };

  Mentioner.prototype.selectOtherDropdownOption = function(getter) {
    var $oldSelected = this.getSelectedDropdownOption();
    var $newSelected = getter.call(this, $oldSelected);
    this.selectDropdownOption($oldSelected, $newSelected);
  };

  Mentioner.prototype.selectDropdownOption = function($oldSelected, $newSelected) {
    $oldSelected.removeClass('dropdown__item--selected');
    $newSelected.addClass('dropdown__item--selected');
  };

  $.fn.mentioner = function (settings) {
    settings = settings || {};

    return this.each(function () {
      var $subject = $( this );

      if($subject.data('mentioner') === undefined) {
        $subject.data('mentioner', new Mentioner($subject, settings));
      }
    });
  };
}(jQuery));
