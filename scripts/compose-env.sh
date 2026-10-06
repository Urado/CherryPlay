write_compose_env() {
    local key="$1"
    local value="$2"
    local output_file="${3:-.env}"

    if [[ ! "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
        return 1
    fi

    value=${value//\\/\\\\}
    value=${value//\"/\\\"}
    value=${value//\$/\$\$}
    value=${value//$'\r'/\\r}
    value=${value//$'\n'/\\n}
    value=${value//$'\t'/\\t}

    printf '%s="%s"\n' "$key" "$value" >> "$output_file"
}
