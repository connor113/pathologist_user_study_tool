#!/usr/bin/env python3
"""
verify-sessions.py - Validate session completeness and event sequences

Usage:
    python verify-sessions.py <csv_file>

Validates:
- Each session has app_start event
- Each session has slide_load event
- Completed sessions have slide_next event with label
- Event sequences are logical
- Per-session statistics
"""

import sys
import argparse
from pathlib import Path
import pandas as pd
from datetime import datetime
from collections import defaultdict


class SessionValidator:
    def __init__(self, csv_path):
        self.csv_path = Path(csv_path)
        self.df = None
        self.errors = []
        self.warnings = []
        self.session_stats = []
        
    def load_data(self):
        """Load CSV"""
        try:
            self.df = pd.read_csv(self.csv_path)
            print(f"[OK] Loaded CSV: {len(self.df)} rows")
            return True
        except Exception as e:
            self.errors.append(f"Failed to load CSV: {e}")
            return False
    
    def check_required_events(self):
        """Check each session has required events"""
        sessions = self.df.groupby('session_id')
        issues = []
        
        for session_id, group in sessions:
            events = set(group['event'].unique())
            
            # Check for app_start (should be first event)
            if 'app_start' not in events:
                issues.append(f"Session {session_id}: Missing app_start event")
            
            # Check for slide_load
            if 'slide_load' not in events:
                issues.append(f"Session {session_id}: Missing slide_load event")
            
            # If has slide_next, should have a label
            if 'slide_next' in events:
                slide_next_rows = group[group['event'] == 'slide_next']
                for idx, row in slide_next_rows.iterrows():
                    if pd.isna(row['label']) or row['label'] == '':
                        issues.append(
                            f"Session {session_id}: slide_next event missing label"
                        )
        
        if issues:
            self.errors.append(
                f"Session event requirements:\n  " + "\n  ".join(issues[:10])
            )
            if len(issues) > 10:
                self.errors.append(f"  ... and {len(issues) - 10} more")
            return False
        
        session_count = len(sessions)
        print(f"[OK] All {session_count} sessions have required events")
        return True
    
    def check_event_sequences(self):
        """Check event sequences are logical"""
        sessions = self.df.groupby('session_id')
        issues = []
        
        for session_id, group in sessions:
            events = group['event'].tolist()
            
            # app_start should be first (or one of the first after potential duplicates)
            if 'app_start' in events:
                first_app_start = events.index('app_start')
                if first_app_start > 2:  # Allow some tolerance
                    issues.append(
                        f"Session {session_id}: app_start not in first events (position {first_app_start})"
                    )
            
            # slide_load should come early (within first few events)
            if 'slide_load' in events:
                first_slide_load = events.index('slide_load')
                if first_slide_load > 5:
                    self.warnings.append(
                        f"Session {session_id}: slide_load late (position {first_slide_load})"
                    )
            
            # Check zoom_step follows cell_click (usually)
            for i, event in enumerate(events):
                if event == 'zoom_step' and i > 0:
                    # Previous event should typically be cell_click (but not always - could be back_step)
                    prev_event = events[i-1]
                    if prev_event not in ['cell_click', 'zoom_step', 'reset']:
                        # This is actually normal after reset, so just count it
                        pass
            
            # slide_next should be last (if present)
            if 'slide_next' in events:
                if events[-1] != 'slide_next':
                    self.warnings.append(
                        f"Session {session_id}: slide_next is not the last event"
                    )
        
        if issues:
            self.errors.append(
                f"Event sequence issues:\n  " + "\n  ".join(issues[:5])
            )
            if len(issues) > 5:
                self.errors.append(f"  ... and {len(issues) - 5} more")
            return False
        
        print(f"[OK] Event sequences are logical")
        return True
    
    def calculate_session_statistics(self):
        """Calculate per-session statistics"""
        sessions = self.df.groupby('session_id')
        
        for session_id, group in sessions:
            # Try to parse timestamps
            try:
                # Timestamps might be in various formats
                timestamps = pd.to_datetime(group['ts_iso8601'], errors='coerce')
                
                if timestamps.isna().all():
                    # Try as strings (might be in non-standard format)
                    duration = "unknown"
                else:
                    timestamps = timestamps.dropna()
                    if len(timestamps) > 1:
                        duration = (timestamps.max() - timestamps.min()).total_seconds()
                    else:
                        duration = 0
            except:
                duration = "unknown"
            
            # Event counts
            event_counts = group['event'].value_counts().to_dict()
            
            # Zoom level distribution
            zoom_dist = group['zoom_level'].value_counts().to_dict()
            
            # Unique cells clicked
            cell_clicks = group[group['event'] == 'cell_click']
            unique_cells = len(cell_clicks.groupby(['i', 'j']))
            
            # Completion status
            completed = 'slide_next' in group['event'].values
            label = None
            if completed:
                label_row = group[group['event'] == 'slide_next'].iloc[0]
                label = label_row['label'] if not pd.isna(label_row['label']) else None
            
            stats = {
                'session_id': session_id,
                'user_id': group['user_id'].iloc[0],
                'slide_id': group['slide_id'].iloc[0],
                'total_events': len(group),
                'duration_sec': duration,
                'cell_clicks': event_counts.get('cell_click', 0),
                'unique_cells': unique_cells,
                'arrow_pans': event_counts.get('arrow_pan', 0),
                'resets': event_counts.get('reset', 0),
                'back_steps': event_counts.get('back_step', 0),
                'zoom_dist': zoom_dist,
                'completed': completed,
                'label': label
            }
            
            self.session_stats.append(stats)
        
        print(f"[OK] Calculated statistics for {len(self.session_stats)} sessions")
        return True
    
    def print_session_statistics(self):
        """Print session statistics summary"""
        if not self.session_stats:
            return
        
        print(f"\n{'='*60}")
        print("SESSION STATISTICS")
        print(f"{'='*60}\n")
        
        # Overall summary
        total_sessions = len(self.session_stats)
        completed_sessions = sum(1 for s in self.session_stats if s['completed'])
        
        print(f"Total sessions: {total_sessions}")
        print(f"Completed: {completed_sessions} ({100*completed_sessions/total_sessions:.1f}%)")
        print()
        
        # Per-session details
        print("Per-session details:")
        print(f"{'Session'[:20]:20s} {'User'[:15]:15s} {'Events':>7s} {'Clicks':>7s} "
              f"{'Unique':>7s} {'Duration':>10s} {'Complete':>9s} {'Label':>10s}")
        print("-" * 100)
        
        for stats in self.session_stats:
            session_short = str(stats['session_id'])[:20]
            user_short = str(stats['user_id'])[:15]
            duration_str = (f"{stats['duration_sec']:.0f}s" 
                           if isinstance(stats['duration_sec'], (int, float)) 
                           else "unknown")
            complete_str = "Y" if stats['completed'] else "N"
            label_str = stats['label'] if stats['label'] else "-"
            
            print(f"{session_short:20s} {user_short:15s} {stats['total_events']:7d} "
                  f"{stats['cell_clicks']:7d} {stats['unique_cells']:7d} "
                  f"{duration_str:>10s} {complete_str:>9s} {label_str:>10s}")
        
        # Aggregate statistics
        total_events = sum(s['total_events'] for s in self.session_stats)
        total_clicks = sum(s['cell_clicks'] for s in self.session_stats)
        total_unique = sum(s['unique_cells'] for s in self.session_stats)
        
        print("-" * 100)
        print(f"{'TOTALS':20s} {'':<15s} {total_events:7d} {total_clicks:7d} "
              f"{total_unique:7d}")
        
        # Averages
        if completed_sessions > 0:
            completed = [s for s in self.session_stats if s['completed']]
            avg_events = sum(s['total_events'] for s in completed) / len(completed)
            avg_clicks = sum(s['cell_clicks'] for s in completed) / len(completed)
            avg_unique = sum(s['unique_cells'] for s in completed) / len(completed)
            
            # Calculate average duration
            durations = [s['duration_sec'] for s in completed 
                        if isinstance(s['duration_sec'], (int, float))]
            avg_duration = sum(durations) / len(durations) if durations else 0
            
            print()
            print(f"Averages (completed sessions only):")
            print(f"  Events per session: {avg_events:.1f}")
            print(f"  Clicks per session: {avg_clicks:.1f}")
            print(f"  Unique cells per session: {avg_unique:.1f}")
            if avg_duration > 0:
                print(f"  Duration per session: {avg_duration:.0f}s ({avg_duration/60:.1f}min)")
        
        # Zoom level distribution
        all_zoom_counts = defaultdict(int)
        for stats in self.session_stats:
            for zoom, count in stats['zoom_dist'].items():
                if pd.notna(zoom):
                    all_zoom_counts[zoom] += count
        
        if all_zoom_counts:
            print()
            print("Zoom level distribution (all sessions):")
            for zoom in sorted(all_zoom_counts.keys()):
                count = all_zoom_counts[zoom]
                pct = 100 * count / total_events
                print(f"  {zoom:4.1f}×: {count:5d} events ({pct:5.1f}%)")
    
    def run_all_checks(self):
        """Run all session validation checks"""
        print(f"\n{'='*60}")
        print(f"Session Validation: {self.csv_path.name}")
        print(f"{'='*60}\n")
        
        if not self.load_data():
            return False
        
        checks = [
            self.check_required_events,
            self.check_event_sequences,
            self.calculate_session_statistics,
        ]
        
        all_passed = True
        for check in checks:
            if not check():
                all_passed = False
        
        return all_passed
    
    def print_summary(self):
        """Print validation summary"""
        self.print_session_statistics()
        
        print(f"\n{'='*60}")
        print("SESSION VALIDATION SUMMARY")
        print(f"{'='*60}")
        
        if self.warnings:
            print(f"\n[WARN] WARNINGS ({len(self.warnings)}):")
            for warning in self.warnings:
                print(f"  {warning}")
        
        if self.errors:
            print(f"\n[ERROR] ERRORS ({len(self.errors)}):")
            for error in self.errors:
                print(f"  {error}")
            print(f"\n[FAIL] SESSION VALIDATION FAILED")
            return False
        else:
            print(f"\n[OK] ALL SESSION CHECKS PASSED")
            return True


def main():
    parser = argparse.ArgumentParser(
        description='Validate session completeness and event sequences'
    )
    parser.add_argument('csv_file', help='Path to CSV file to validate')
    
    args = parser.parse_args()
    
    validator = SessionValidator(args.csv_file)
    passed = validator.run_all_checks()
    validator.print_summary()
    
    sys.exit(0 if passed else 1)


if __name__ == '__main__':
    main()

