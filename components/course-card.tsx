"use client";

import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { BookOpen, Calendar, Clock, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Course } from '@/lib/supabase';

interface CourseCardProps {
  course: Course;
}

const statusConfig = {
  draft: {
    label: 'Borrador',
    className: 'bg-muted text-muted-foreground',
  },
  active: {
    label: 'Activo',
    className: 'bg-[#2f9e44] text-white',
  },
  closed: {
    label: 'Finalizado',
    className: 'bg-[#d94848] text-white',
  },
};

export function CourseCard({ course }: CourseCardProps) {
  const router = useRouter();
  const status = statusConfig[course.status];

  return (
    <Card
      className="p-6 hover:shadow-lg transition-all cursor-pointer group"
      onClick={() => router.push(`/course/${course.id}`)}
    >
      <div className="flex items-start justify-between">
        <div className="flex gap-4 flex-1">
          <div className="w-12 h-12 rounded-lg bg-[#2166be]/10 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-6 h-6 text-[#2166be]" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-3">
              <h3 className="text-xl font-semibold text-foreground">
                {course.name}
              </h3>
              <Badge className={status.className}>
                {status.label}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>
                  {format(new Date(course.date + 'T12:00:00'), "d 'de' MMMM, yyyy", {
                    locale: es,
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>
                  {course.duration_hours}{' '}
                  {course.duration_hours === 1 ? 'hora' : 'horas'}
                </span>
              </div>
            </div>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>
    </Card>
  );
}
