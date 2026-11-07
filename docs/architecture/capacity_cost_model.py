"""Offline planning calculator. No provider calls, credentials or provisioning."""
import argparse
import json
import math
from pathlib import Path

INPUTS = Path(__file__).with_name('capacity-cost-inputs.json')


def calculate(data, scenario):
    s = data['scenarios'][scenario]
    w, c = data['workload'], data['common']
    r = {k: v['value'] for k, v in data['rates'].items()}
    assert 0 <= s['peer_fraction'] <= 1 and 0 <= s['voice_fraction'] <= 1
    assert 0 < w['utilization_target'] <= 1
    assert s['sandbox_nodes_min'] <= s['sandbox_nodes_max']
    assert all(v >= 0 for v in r.values())
    h = data['month_hours']
    sessions = s['mau'] * w['dau_fraction'] * w['sessions_per_dau'] * data['traffic_days']
    jobs = sessions * w['jobs_per_session']
    dispatched_jobs = jobs * w['job_retry_multiplier']
    job_seconds = w['job_runtime_seconds'] + w['job_startup_seconds']
    peak_rate = dispatched_jobs / (data['traffic_days'] * 86400) * w['peak_multiplier']
    required_slots = math.ceil(peak_rate * job_seconds / w['utilization_target'])
    peak_nodes = math.ceil(required_slots / w['slots_per_sandbox_node'])
    variable_node_hours_required = dispatched_jobs * job_seconds / 3600 / w['slots_per_sandbox_node'] / w['utilization_target']
    fixed_node_hours = s['sandbox_nodes_min'] * h
    sandbox_node_hours = max(fixed_node_hours + s['sandbox_extra_node_hours'], variable_node_hours_required)
    assert sandbox_node_hours <= s['sandbox_nodes_max'] * h, 'monthly node-hour cap exceeded'
    fixed = {
        'gke_management': h * r['gke_hour'],
        'trusted_nodes': h * s['system_nodes'] * r['system_node_hour'],
        'sandbox_idle_floor': fixed_node_hours * r['sandbox_node_hour'],
        'sql_ha_compute': h * (c['sql_cpu'] * r['sql_ha_cpu_hour'] + c['sql_gib'] * r['sql_ha_gib_hour']),
        'sql_ha_disk_backup': h * (c['sql_disk_gib'] * r['sql_ha_ssd_gib_hour'] + c['sql_backup_gib'] * r['sql_backup_gib_hour']),
        'redis_standard': h * c['redis_gib'] * r['redis_gib_hour'],
        'cloud_run_warm': h * 3600 * c['run_warm_instances'] * (c['run_cpu'] * r['run_cpu_second'] + c['run_gib'] * r['run_gib_second']),
        **data['allowances_monthly']}
    peer_raw = (w['peer_turns'] * (w['peer_input_per_turn'] * r['peer_input_million'] + w['peer_output_per_turn'] * r['peer_output_million']) + w['semantic_calls'] * (w['semantic_input'] * r['review_input_million'] + w['semantic_output'] * r['review_output_million'])) / 1e6
    peer_with_overhead = peer_raw * w['provider_usage_multiplier']
    peer_sessions = sessions * s['peer_fraction']
    voice_raw = w['voice_input_minutes'] * r['stt_minute'] + w['voice_output_minutes'] * r['tts_minute']
    # Upper-bound traces at max serialized size, with steady-state seven-day retention.
    trace_gib = dispatched_jobs * w['trace_mib_per_job'] / 1024 * min(w['trace_retention_days'] / data['traffic_days'], 1)
    source_gib = sessions * w['source_kib_per_session'] / 1024**2
    queue_tib = dispatched_jobs * c['pubsub_kib_per_job_per_leg'] * c['pubsub_legs'] / 1024**3
    variable = {
        'sandbox_above_idle': (sandbox_node_hours - fixed_node_hours) * r['sandbox_node_hour'],
        'text_provider': peer_sessions * peer_with_overhead,
        'voice_provider': peer_sessions * s['voice_fraction'] * voice_raw * w['provider_usage_multiplier'],
        'object_storage': (c['object_floor_gib'] + trace_gib + source_gib) * h * r['object_gib_hour'],
        'queue_throughput': queue_tib * r['pubsub_tib'],
        'log_ingestion': c['logs_gib'] * r['log_gib']}
    subtotal = sum(fixed.values()) + sum(variable.values())
    total = subtotal * (1 + c['contingency_fraction'])
    node_total = fixed['trusted_nodes'] + fixed['sandbox_idle_floor'] + variable['sandbox_above_idle']
    return {
        'scenario':scenario, 'sessions_month':sessions, 'jobs_month':jobs, 'jobs_with_retry_reserve':dispatched_jobs,
        'durable_events_month':sessions*w['durable_events_per_session'],
        'average_concurrent_sessions':sessions*w['session_minutes']/(data['traffic_days']*1440),
        'peak_concurrent_sessions':sessions*w['session_minutes']/(data['traffic_days']*1440)*w['peak_multiplier'],
        'peak_jobs_second':peak_rate, 'required_execution_slots':required_slots,
        'required_sandbox_nodes_peak':peak_nodes, 'configured_peak_nodes':s['sandbox_nodes_max'],
        'capacity_fits_arithmetic':peak_nodes <= s['sandbox_nodes_max'],
        'sandbox_node_hours':sandbox_node_hours, 'retained_trace_gib_upper_bound':trace_gib,
        'text_session_raw':peer_raw, 'text_session_with_overhead':peer_with_overhead,
        'voice_session_raw_increment':voice_raw, 'fixed_usd':fixed, 'variable_usd':variable,
        'subtotal_usd':subtotal, 'contingency_usd':total-subtotal, 'planning_total_usd':total,
        'within_proposed_ceiling':total <= c['monthly_ceiling_proposed'],
        'node_cost_allocated_per_job':node_total/jobs if jobs else None,
        'quote_or_approval_complete':False,
        'scale_limitation':'Fixed service sizes and allowances are not a scale quote' if scenario=='scale_reference' else None}


def review_reserve(data):
    q = data['review_reserve']
    rates = data['rates']
    content = q['cases']*q['reviews_per_case']*q['hours_per_review']*rates['case_reviewer_hour']['value']
    security = (q['security_hours']+q['retest_hours'])*rates['security_reviewer_hour']['value']
    return {'content_usd':content,'security_retest_usd':security,'total_with_contingency_usd':(content+security)*(1+q['contingency_fraction'])}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inputs',type=Path,default=INPUTS)
    args=parser.parse_args()
    data=json.loads(args.inputs.read_text())
    print(json.dumps({'as_of':data['as_of'],'currency':data['currency'],'scenarios':[calculate(data,k) for k in data['scenarios']],'review_reserve':review_reserve(data)},indent=2))

if __name__=='__main__':
    main()
