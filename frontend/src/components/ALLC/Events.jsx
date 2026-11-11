import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

export default function EventItem({ event, isExpanded, onToggle, loading }) {
    return (
        <div
            className="bg-blue-600 text-white p-4 rounded-lg cursor-pointer hover:bg-blue-700 transition flex items-center gap-3"
            onClick={onToggle}
        >
            {isExpanded ? (
                <ChevronDown className="h-6 w-6 shrink-0 text-white transition-transform" />
            ) : (
                <ChevronRight className="h-6 w-6 shrink-0 text-white transition-transform" />
            )}
            <span className="font-semibold flex-1">{event.eventname}</span>
            <span className="text-xs opacity-75">{event.eventcode}</span>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-white opacity-75" />}
        </div>
    );
}
