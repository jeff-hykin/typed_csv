import json
import ez_yaml
import re
from datetime import datetime

# small helpers
w3schools_iso_date_regex = r"(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))"
extra_iso_date_regex = r"(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+)|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d)|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d)"
simple_date_regex = r"^\d{4}-\d{1,2}-\d{1,2}($| |\t)"
def matches_iso8601_date(string):
    return re.match(w3schools_iso_date_regex, string) or re.match(extra_iso_date_regex, string)
def matches_reserved_pattern(string):
    return (
        # to allow computed items / equations
        string.startswith("=") or
        # to allow regex (yeah yeah i know i know)
        (string.startswith("/") and re.search(r"/([igmusyv]*)$", string)) or
        # default comment symbol
        string.startswith("#") or
        # to allow durations and times in the future
        re.match(r"^\d+:", string) or
        # to allow dates (no times) either YYYY-MM-DD and DD/MM/YYYY (probably only want to support YYYY-MM-DD, but will reserve both)
        re.match(simple_date_regex, string) or re.match(r"^\d{1,2}/\d{1,2}/\d{1,2}($| |\t)", string) or
        # ISO date
        matches_iso8601_date(string)
    )

def parse_cell(each):
    """
    Resolves a value from a CSV cell to a typed Python value.

    This function handles various types of values that may appear in a CSV cell,
    including empty strings, NaN, Infinity, regular expressions, and dates.
    It uses the YAML parser to handle more complex values like objects and arrays.

    Args:
        each (str): The CSV cell value to be resolved.

    Returns:
        any: The resolved Python value.
    """
    trimmed = each.strip()
    if len(trimmed) == 0:
        return None

    # nan
    if re.match(r'^\.?nan$', trimmed, re.I):
        return float('nan')

    # infinity
    if re.match(r'^-?\.?(inf|infinity)$', trimmed, re.I):
        return float('-inf') if trimmed.startswith('-') else float('inf')

    # regex
    if trimmed.startswith("/"):
        flags = re.match(r'/([igmusyv]*)$', trimmed)
        if flags:
            return re.compile(trimmed[1:-len(flags.group(0))], flags.group(1))

    # date
    if re.match(simple_date_regex, each) or matches_iso8601_date(each):
        return datetime.fromisoformat(each)

    # NOTE: durations and times-of-day are not supported in this implementation

    # everything else (numbers, boolean, strings, lists, mappings)
    try:
        return ez_yaml.to_obj(string=trim)
    except:
        # failure to parse means it's a string literal
        return each


def stringify_cell(each, options=None):
    """
    Escapes a value for inclusion in a CSV cell, handling various data types.

    This function ensures that the CSV cell value is properly formatted for the
    given data type. It handles cases like None, empty strings, dates, and
    regular expressions, converting them to appropriate string representations.
    It also uses the YAML library to properly format complex data types like
    objects and arrays.

    Args:
        each: The value to be escaped for the CSV cell.
        options (dict): Optional configuration options.

    Returns:
        str: The escaped CSV cell value.
    """
    options = options or {}

    # None becomes empty cell or "null"
    if each is None:
        return "" if options.get('null_as_empty') else "null"

    # empty strings contain quotes
    if each == "":
        return '""'
    
    # Date
    if isinstance(each, datetime):
        return each.isoformat()

    # Regex
    if isinstance(each, re.Pattern):
        return each.pattern

    # custom converter
    if hasattr(each, '__typed_csv__') and callable(getattr(each, '__typed_csv__')):
        return each.__typed_csv__(options)

    # remaining non-strings just get yamlified
    if not isinstance(each, str):
        return ez_yaml.to_string(obj=each, **options.get('yaml_options', {})).rstrip('\n')

    # strings
    if matches_reserved_pattern(each):
        return json.dumps(each)

    # otherwise rely on yaml to quote it correctly or make it a block-string
    as_string = ez_yaml.to_string(obj=each)
    if (as_string.startswith('"') or as_string.startswith("'")) and as_string.endswith('\n'):
        return as_string[:-1]
    else:
        each = str(each)
        if len(each) + 1 == len(as_string) and as_string.endswith('\n') and not each.endswith('\n'):
            return as_string[:-1]
        return as_string
