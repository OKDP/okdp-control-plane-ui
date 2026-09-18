// Trino SQL dialect for CodeMirror's `@codemirror/lang-sql`.
//
// `@codemirror/lang-sql` ships dialects for Postgres/MySQL/MSSQL/SQLite… but
// not Trino, the engine the SQL Editor talks to. We define one here: the
// keyword/type/function lists drive both syntax highlighting (the Lezer
// tokenizer tags anything in these lists) and autocompletion —
// `keywordCompletionSource` completes from the dialect's combined
// keywords + types + builtin word list, so functions placed in `builtin`
// surface as completions alongside keywords.
import { SQLDialect, keywordCompletionSource } from '@codemirror/lang-sql';
import type { CompletionSource } from '@codemirror/autocomplete';

/** Reserved + commonly used statement keywords (Trino grammar). Lower-case
 *  here; the completion source upper-cases them when asked. */
const KEYWORDS = [
  'add all alter analyze and any array as asc at authorization between by',
  'call cascade case cast catalog catalogs column columns comment commit',
  'committed constraint create cross cube current current_catalog current_date',
  'current_path current_role current_schema current_time current_timestamp',
  'current_user data deallocate define delete desc describe distinct distributed',
  'drop else end escape except excluding execute exists explain extract false',
  'fetch filter final first following for format from full function functions',
  'grant granted graphviz group grouping groups having if ignore in including',
  'initial inner input insert intersect interval into invoker io is isolation',
  'join json_array json_exists json_object json_query json_table json_value last',
  'lateral left level like limit local localtime localtimestamp logical match',
  'matched materialized measures merge natural next nfc nfd nfkc nfkd no none',
  'normalize not null nulls of offset on only option or order ordinality outer',
  'output over overflow partition partitions passing past pattern per permute',
  'position preceding prepare privileges properties prune range reading recursive',
  'refresh rename repeatable replace reset respect restrict returning revoke right',
  'role roles rollback rollup row rows running schema schemas seek select serializable',
  'session set sets show skip some start stats substring system table tables',
  'tablesample then ties time timestamp to top trim true truncate try_cast type',
  'uescape unbounded uncommitted union unmatched unnest update use user using',
  'validate values verbose view when where window with within without work zone',
].join(' ');

/** Trino data types. */
const TYPES = [
  'boolean tinyint smallint integer int bigint real double decimal',
  'varchar char varbinary json date time timestamp interval',
  'array map row ipaddress uuid hyperloglog qdigest tdigest',
  'p4hyperloglog geometry sphericalgeography color',
].join(' ');

/** A generous (not exhaustive) set of Trino built-in functions — scalar,
 *  aggregate and window — so completion is useful out of the box. Highlighted
 *  as built-ins and offered as completions. */
const FUNCTIONS = [
  // aggregate / window
  'count count_if sum avg min max min_by max_by arbitrary array_agg bool_and',
  'bool_or checksum every geometric_mean histogram listagg map_agg map_union',
  'multimap_agg reduce_agg set_agg set_union stddev stddev_pop stddev_samp',
  'variance var_pop var_samp corr covar_pop covar_samp skewness kurtosis',
  'regr_intercept regr_slope approx_distinct approx_percentile approx_set merge',
  'numeric_histogram qdigest_agg row_number rank dense_rank percent_rank cume_dist',
  'ntile first_value last_value nth_value lag lead',
  // conditional / util
  'coalesce nullif greatest least try typeof if',
  // string
  'length lower upper trim ltrim rtrim replace reverse substr substring split',
  'split_part split_to_map concat concat_ws position strpos format format_number',
  'regexp_like regexp_replace regexp_extract regexp_extract_all regexp_split lpad',
  'rpad starts_with to_utf8 from_utf8 normalize soundex levenshtein_distance',
  'hamming_distance codepoint chr ascii word_stem translate',
  // math
  'abs ceil ceiling floor round sign mod power pow sqrt cbrt exp ln log log2',
  'log10 sin cos tan asin acos atan atan2 sinh cosh tanh radians degrees pi e',
  'rand random infinity is_finite is_infinite is_nan nan width_bucket from_base',
  'to_base cosine_similarity bitwise_and bitwise_or bitwise_xor bitwise_not',
  // date / time
  'now date date_add date_diff date_trunc date_format date_parse format_datetime',
  'parse_datetime from_unixtime to_unixtime from_iso8601_date from_iso8601_timestamp',
  'to_iso8601 day day_of_month day_of_week day_of_year dow doy hour minute second',
  'month quarter week week_of_year year year_of_week yow millisecond last_day_of_month',
  'at_timezone with_timezone current_timezone to_milliseconds',
  // array
  'array_distinct array_intersect array_union array_except array_join array_max',
  'array_min array_position array_remove array_sort arrays_overlap cardinality',
  'contains element_at filter flatten ngrams reduce repeat sequence shuffle slice',
  'transform zip zip_with combinations all_match any_match none_match',
  // map
  'map map_concat map_entries map_filter map_from_entries map_keys map_values',
  'map_zip_with transform_keys transform_values multimap_from_entries',
  // json
  'json_array_contains json_array_length json_extract json_extract_scalar',
  'json_format json_parse json_size is_json_scalar',
  // url / hash / misc
  'url_encode url_decode url_extract_host url_extract_path url_extract_protocol',
  'url_extract_query url_extract_parameter crc32 md5 sha1 sha256 sha512 murmur3',
  'xxhash64 spooky_hash_v2_32 from_big_endian_64 to_big_endian_64 uuid',
].join(' ');

/** Trino dialect: ANSI-style strings (single-quote, `''` escapes, no
 *  backslash escapes), double quotes are identifiers, `--` / `/* *\/`
 *  comments, case-insensitive unquoted identifiers. */
export const TrinoSQL: SQLDialect = SQLDialect.define({
  keywords: KEYWORDS,
  types: TYPES,
  builtin: FUNCTIONS,
  backslashEscapes: false,
  hashComments: false,
  slashComments: false,
  doubleQuotedStrings: false,
  caseInsensitiveIdentifiers: true,
});

/** Completion source for Trino keywords, types and functions (upper-cased). */
export const trinoKeywordCompletion: CompletionSource = keywordCompletionSource(TrinoSQL, true);
