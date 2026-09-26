"""
Elasticsearch client — queries logs, traces, and deployments for an incident.
"""
from __future__ import annotations
import os
from typing import List, Dict, Any, Optional
from elasticsearch import Elasticsearch


class ESClient:
    def __init__(self, host: str = None):
        self.host = host or os.getenv("ES_HOST", "http://localhost:9200")
        self.es = Elasticsearch(self.host)

    def is_healthy(self) -> bool:
        try:
            self.es.cluster.health(timeout="2s")
            return True
        except Exception:
            return False

    def get_logs(self, incident_id: str, level: Optional[str] = None, size: int = 200) -> List[Dict]:
        """Fetch log entries, optionally filtered by level."""
        index = f"logs-{incident_id.lower()}"
        query: Dict[str, Any] = {"match_all": {}}
        if level:
            query = {"terms": {"level": [level.upper()]}}
        try:
            result = self.es.search(
                index=index,
                body={"query": query, "sort": [{"timestamp": "asc"}], "size": size}
            )
            return [hit["_source"] for hit in result["hits"]["hits"]]
        except Exception as e:
            return []

    def get_error_logs(self, incident_id: str) -> List[Dict]:
        """Fetch only ERROR and CRITICAL logs."""
        index = f"logs-{incident_id.lower()}"
        try:
            result = self.es.search(
                index=index,
                body={
                    "query": {"terms": {"level": ["ERROR", "CRITICAL"]}},
                    "sort": [{"timestamp": "asc"}],
                    "size": 200
                }
            )
            return [hit["_source"] for hit in result["hits"]["hits"]]
        except Exception:
            return []

    def get_traces(self, incident_id: str) -> List[Dict]:
        """Fetch distributed trace spans."""
        index = f"traces-{incident_id.lower()}"
        try:
            result = self.es.search(
                index=index,
                body={"query": {"match_all": {}}, "sort": [{"timestamp": "asc"}], "size": 500}
            )
            return [hit["_source"] for hit in result["hits"]["hits"]]
        except Exception:
            return []

    def get_traces_by_id(self, incident_id: str, trace_id: str) -> List[Dict]:
        """Get all spans for a specific trace."""
        index = f"traces-{incident_id.lower()}"
        try:
            result = self.es.search(
                index=index,
                body={"query": {"term": {"trace_id": trace_id}}, "sort": [{"timestamp": "asc"}]}
            )
            return [hit["_source"] for hit in result["hits"]["hits"]]
        except Exception:
            return []

    def get_log_pattern_summary(self, incident_id: str) -> Dict:
        """Aggregate log levels by service for anomaly summary."""
        index = f"logs-{incident_id.lower()}"
        try:
            result = self.es.search(
                index=index,
                body={
                    "query": {"match_all": {}},
                    "aggs": {
                        "by_service": {
                            "terms": {"field": "service"},
                            "aggs": {
                                "by_level": {"terms": {"field": "level"}}
                            }
                        }
                    },
                    "size": 0
                }
            )
            summary = {}
            for bucket in result["aggregations"]["by_service"]["buckets"]:
                svc = bucket["key"]
                summary[svc] = {lvl["key"]: lvl["doc_count"] for lvl in bucket["by_level"]["buckets"]}
            return summary
        except Exception:
            return {}
