var define = function (object, name, value) {
  var key;

  // if an object, loop the properties for the definitions
  if (typeof name === "object") {
    for (key in name) {
      if (name.hasOwnProperty(key)) {
        define(object, key, name[key]);
      }
    }
    // otherwise, just operate on a single property
  } else {
    Object.defineProperty(object, name, {
      value:        value,
      enumerable:   true,
      writable:     false,
      configurable: false
    });
  }

  return object;
};

var constants = {};
define(constants, {
  PREFS_IS_ENABLED					: "IsEnabled",
  PREFS_AUTOMATICALLY_OPEN_TORRENT	: "AutomaticallyOpenTorrent",
  PREFS_TORRENT_FOLDER				: "TorrentFolder",
  PREFS_QUALITY						: "Quality",
  PREFS_SCRIPTVERSION					: "ScriptVersion",
  PREFS_LASTVERSIONCHECK				: "SULastCheckTime",

  // "SeasonEpisodeType"	# Shows organised by season/episode (eg: Lost)
  TYPE_SEASONEPISODE					: "SeasonEpisodeType",
  // "DateType"			# Shows organised by date (eg: The Daily Show)
  TYPE_DATE							: "DateType",
  // "TimeType"			# Shows not organised at all (eg: Dicovery Channel), so we organize them by published time
  TYPE_TIME							: "TimeType",

  SHOWS_SHOWS							: "Shows",
  SHOWS_VERSION						: "Version",
  SHOW_HUMANNAME						: "HumanName",
  SHOW_EXACTNAME						: "ExactName",
  SHOW_EPISODE						: "Episode",
  SHOW_SEASON							: "Season",
  SHOW_SUBSCRIBED						: "Subscribed",
  SHOW_DATE							: "Date",
  SHOW_TITLE							: "Title",
  SHOW_TYPE							: "Type",
  SHOW_TIME							: "Time",

  FEED : "http://ezrss.it/search/index.php?show_name:%s&show_name_exact:true&mode:rss",
  REQUIRED_KEYS : ["SHOW_HUMANNAME","SHOW_EXACTNAME","SHOW_SUBSCRIBED","SHOW_TYPE"],
  QUALITIES : ["HD","WS","DSRIP","TVRIP","PDTV","DVD","HR","720"]
});

exports.constants = constants;

var tvnamer_config = {
    "always_move": false, 
    "always_rename": false, 
    "batch": false, 
    "custom_filename_character_blacklist": "", 
    "episode_separator": "-", 
    "episode_single": "%02d", 
    "filename_anime_with_episode": "[%(group)s] %(seriesname)s - %(episode)s - %(episodename)s [%(crc)s]%(ext)s", 
    "filename_anime_with_episode_without_crc": "[%(group)s] %(seriesname)s - %(episode)s - %(episodename)s%(ext)s", 
    "filename_anime_without_episode": "[%(group)s] %(seriesname)s - %(episode)s [%(crc)s]%(ext)s", 
    "filename_anime_without_episode_without_crc": "[%(group)s] %(seriesname)s - %(episode)s%(ext)s", 
    "filename_blacklist": [], 
    "filename_patterns": [
        "^\\[(?P<group>.+?)\\][ ]?               # group name, captured for [#100]\n        (?P<seriesname>.*?)[ ]?[-_][ ]?          # show name, padding, spaces?\n        (?P<episodenumberstart>\\d+)              # first episode number\n        ([-_]\\d+)*                               # optional repeating episodes\n        [-_](?P<episodenumberend>\\d+)            # last episode number\n        (?=                                      # Optional group for crc value (non-capturing)\n          .*                                     # padding\n          \\[(?P<crc>.+?)\\]                       # CRC value\n        )?                                       # End optional crc group\n        [^\\/]*$", 
        "^\\[(?P<group>.+?)\\][ ]?               # group name, captured for [#100]\n        (?P<seriesname>.*)                       # show name\n        [ ]?[-_][ ]?                             # padding and seperator\n        (?P<episodenumber>\\d+)                   # episode number\n        (?=                                      # Optional group for crc value (non-capturing)\n          .*                                     # padding\n          \\[(?P<crc>.+?)\\]                       # CRC value\n        )?                                       # End optional crc group\n        [^\\/]*$", 
        "\n        ^((?P<seriesname>.+?)[ \\._\\-])?          # show name\n        [Ss](?P<seasonnumber>[0-9]+)             # s01\n        [\\.\\- ]?                                 # separator\n        [Ee](?P<episodenumberstart>[0-9]+)       # first e23\n        ([\\.\\- ]+                                # separator\n        [Ss](?P=seasonnumber)                    # s01\n        [\\.\\- ]?                                 # separator\n        [Ee][0-9]+)*                             # e24 etc (middle groups)\n        ([\\.\\- ]+                                # separator\n        [Ss](?P=seasonnumber)                    # last s01\n        [\\.\\- ]?                                 # separator\n        [Ee](?P<episodenumberend>[0-9]+))        # final episode number\n        [^\\/]*$", 
        "\n        ^((?P<seriesname>.+?)[ \\._\\-])?          # show name\n        [Ss](?P<seasonnumber>[0-9]+)             # s01\n        [\\.\\- ]?                                 # separator\n        [Ee](?P<episodenumberstart>[0-9]+)       # first e23\n        ([\\.\\- ]?                                # separator\n        [Ee][0-9]+)*                             # e24e25 etc\n        [\\.\\- ]?[Ee](?P<episodenumberend>[0-9]+) # final episode num\n        [^\\/]*$", 
        "\n        ^((?P<seriesname>.+?)[ \\._\\-])?          # show name\n        (?P<seasonnumber>[0-9]+)                 # first season number (1)\n        [xX](?P<episodenumberstart>[0-9]+)       # first episode (x23)\n        ([ \\._\\-]+                               # separator\n        (?P=seasonnumber)                        # more season numbers (1)\n        [xX][0-9]+)*                             # more episode numbers (x24)\n        ([ \\._\\-]+                               # separator\n        (?P=seasonnumber)                        # last season number (1)\n        [xX](?P<episodenumberend>[0-9]+))        # last episode number (x25)\n        [^\\/]*$", 
        "\n        ^((?P<seriesname>.+?)[ \\._\\-])?          # show name\n        (?P<seasonnumber>[0-9]+)                 # 1\n        [xX](?P<episodenumberstart>[0-9]+)       # first x23\n        ([xX][0-9]+)*                            # x24x25 etc\n        [xX](?P<episodenumberend>[0-9]+)         # final episode num\n        [^\\/]*$", 
        "\n        ^((?P<seriesname>.+?)[ \\._\\-])?          # show name\n        [Ss](?P<seasonnumber>[0-9]+)             # s01\n        [\\.\\- ]?                                 # separator\n        [Ee](?P<episodenumberstart>[0-9]+)       # first e23\n        (                                        # -24 etc\n             [\\-]\n             [Ee]?[0-9]+\n        )*\n             [\\-]                                # separator\n             [Ee]?(?P<episodenumberend>[0-9]+)   # final episode num\n        [\\.\\- ]                                  # must have a separator (prevents s01e01-720p from being 720 episodes)\n        [^\\/]*$", 
        "\n        ^((?P<seriesname>.+?)[ \\._\\-])?          # show name\n        (?P<seasonnumber>[0-9]+)                 # 1\n        [xX](?P<episodenumberstart>[0-9]+)       # first x23\n        (                                        # -24 etc\n             [\\-+][0-9]+\n        )*\n             [\\-+]                               # separator\n             (?P<episodenumberend>[0-9]+)        # final episode num\n        ([\\.\\-+ ].*                              # must have a separator (prevents 1x01-720p from being 720 episodes)\n        |\n        $)", 
        "^(?P<seriesname>.+?)[ \\._\\-]          # show name and padding\n        \\[                                       # [\n            ?(?P<seasonnumber>[0-9]+)            # season\n        [xX]                                     # x\n            (?P<episodenumberstart>[0-9]+)       # episode\n            ([\\-+] [0-9]+)*\n        [\\-+]                                    # -\n            (?P<episodenumberend>[0-9]+)         # episode\n        \\]                                       # \\]\n        [^\\/]*$", 
        "^((?P<seriesname>.+?)[ \\._\\-])?       # show name and padding\n        \\[                                       # [ not optional (or too ambigious)\n        (?P<episodenumber>[0-9]+)                # episode\n        \\]                                       # ]\n        [^\\/]*$", 
        "^(?P<seriesname>.+?)[ \\._\\-]\n        [Ss](?P<seasonnumber>[0-9]{2})\n        [\\.\\- ]?\n        (?P<episodenumber>[0-9]{2})\n        [^0-9]*$", 
        "^((?P<seriesname>.+?)[ \\._\\-])?       # show name and padding\n        \\[?                                      # [ optional\n        (?P<seasonnumber>[0-9]+)                 # season\n        [xX]                                     # x\n        (?P<episodenumber>[0-9]+)                # episode\n        \\]?                                      # ] optional\n        [^\\/]*$", 
        "^((?P<seriesname>.+?)[ \\._\\-])?\n        \\[?\n        [Ss](?P<seasonnumber>[0-9]+)[ ]?[\\._\\- ]?[ ]?\n        [Ee]?(?P<episodenumber>[0-9]+)\n        \\]?\n        [^\\/]*$", 
        "\n        ^((?P<seriesname>.+?)[ \\._\\-])?          # show name\n        (?P<year>\\d{4})                          # year\n        [ \\._\\-]                                 # separator\n        (?P<month>\\d{2})                         # month\n        [ \\._\\-]                                 # separator\n        (?P<day>\\d{2})                           # day\n        [^\\/]*$", 
        "^((?P<seriesname>.+?))                # show name\n        [ \\._\\-]?                                # padding\n        \\[                                       # [\n        (?P<seasonnumber>[0-9]+?)                # season\n        [.]                                      # .\n        (?P<episodenumber>[0-9]+?)               # episode\n        \\]                                       # ]\n        [ \\._\\-]?                                # padding\n        [^\\/]*$", 
        "^(?P<seriesname>.+?)[ ]?[ \\._\\-][ ]?\n        [Ss](?P<seasonnumber>[0-9]+)[\\.\\- ]?\n        [Ee]?[ ]?(?P<episodenumber>[0-9]+)\n        [^\\/]*$", 
        "\n        (?P<seriesname>.+)                       # Showname\n        [ ]-[ ]                                  # -\n        [Ee]pisode[ ]\\d+                         # Episode 1234 (ignored)\n        [ ]\n        \\[                                       # [\n        [sS][ ]?(?P<seasonnumber>\\d+)            # s 12\n        ([ ]|[ ]-[ ]|-)                          # space, or -\n        ([eE]|[eE]p)[ ]?(?P<episodenumber>\\d+)   # e or ep 12\n        \\]                                       # ]\n        .*$                                      # rest of file\n        ", 
        "^(?P<seriesname>.+?)                  # Show name\n        [ \\._\\-]                                 # Padding\n        (?P<episodenumber>[0-9]+)                # 2\n        of                                       # of\n        [ \\._\\-]?                                # Padding\n        \\d+                                      # 6\n        ([\\._ -]|$|[^\\/]*$)                     # More padding, then anything\n        ", 
        "^(?i)\n        (?P<seriesname>.+?)                        # Show name\n        [ \\._\\-]                                   # Padding\n        (?:part|pt)?[\\._ -]\n        (?P<episodenumberstart>[0-9]+)             # Part 1\n        (?:\n          [ \\._-](?:and|&|to)                        # and\n          [ \\._-](?:part|pt)?                        # Part 2\n          [ \\._-](?:[0-9]+))*                        # (middle group, optional, repeating)\n        [ \\._-](?:and|&|to)                        # and\n        [ \\._-]?(?:part|pt)?                       # Part 3\n        [ \\._-](?P<episodenumberend>[0-9]+)        # last episode number, save it\n        [\\._ -][^\\/]*$                            # More padding, then anything\n        ", 
        "^(?P<seriesname>.+?)                  # Show name\n\n        [ \\._\\-]                               # Padding\n\n        [Pp]art[ ](?P<episodenumber>[0-9]+)      # Part 1\n\n        [\\._ -][^\\/]*$                         # More padding, then anything\n\n        ", 
        "^(?P<seriesname>.+?)[ ]?               # Show name\n        [Ss]eason[ ]?(?P<seasonnumber>[0-9]+)[ ]? # Season 1\n        [Ee]pisode[ ]?(?P<episodenumber>[0-9]+)   # Episode 20\n        [^\\/]*$", 
        "^(?P<seriesname>.+)[ \\._\\-]\n        (?P<seasonnumber>[0-9]{1})\n        (?P<episodenumber>[0-9]{2})\n        [\\._ -][^\\/]*$", 
        "^(?P<seriesname>.+)[ \\._\\-]\n        (?P<seasonnumber>[0-9]{2})\n        (?P<episodenumber>[0-9]{2,3})\n        [\\._ -][^\\/]*$", 
        "^(?P<seriesname>.+?)                  # Show name\n        [ \\._\\-]                                 # Padding\n        [Ee](?P<episodenumber>[0-9]+)            # E123\n        [\\._ -][^\\/]*$                          # More padding, then anything\n        "
    ], 
    "filename_with_date_and_episode": "%(seriesname)s - [%(episode)s] - %(episodename)s%(ext)s", 
    "filename_with_date_without_episode": "%(seriesname)s - [%(episode)s]%(ext)s", 
    "filename_with_episode": "%(seriesname)s - [%(seasonnumber)02dx%(episode)s] - %(episodename)s%(ext)s", 
    "filename_with_episode_no_season": "%(seriesname)s - [%(episode)s] - %(episodename)s%(ext)s", 
    "filename_without_episode": "%(seriesname)s - [%(seasonnumber)02dx%(episode)s]%(ext)s", 
    "filename_without_episode_no_season": "%(seriesname)s - [%(episode)s]%(ext)s", 
    "force_name": null, 
    "input_filename_replacements": [], 
    "input_series_replacements": {}, 
    "language": "en", 
    "lowercase_filename": false, 
    "move_files_confirmation": true, 
    "move_files_destination": ".", 
    "move_files_destination_date": ".", 
    "move_files_destination_is_filepath": false, 
    "move_files_enable": false, 
    "move_files_fullpath_replacements": [], 
    "move_files_lowercase_destination": false, 
    "move_files_only": false, 
    "multiep_join_name_with": ", ", 
    "normalize_unicode_filenames": false, 
    "output_filename_replacements": [], 
    "output_series_replacements": {}, 
    "overwrite_destination_on_move": false, 
    "overwrite_destination_on_rename": false, 
    "recursive": false, 
    "replace_invalid_characters_with": "_", 
    "search_all_languages": true, 
    "select_first": false, 
    "series_id": null, 
    "skip_file_on_error": true, 
    "titlecase_filename": false, 
    "valid_extensions": [], 
    "verbose": false, 
    "windows_safe_filenames": false
};
