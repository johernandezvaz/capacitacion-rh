"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Plus, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CourseCard } from '@/components/course-card';
import { CreateCourseModal } from '@/components/create-course-modal';
import { supabase, TrainingYear, Course } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export default function YearDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const [year, setYear] = useState<TrainingYear | null>(null);
    const [courses, setCourses] = useState<Course[]>([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const fetchYearAndCourses = async () => {
        try {
            const { data: yearData, error: yearError } = await supabase
                .from('training_years')
                .select('*')
                .eq('id', params.id)
                .maybeSingle();

            if (yearError) throw yearError;
            if (!yearData) {
                router.push('/');
                return;
            }
            setYear(yearData);

            const { data: coursesData, error: coursesError } = await supabase
                .from('courses')
                .select('*')
                .eq('year_id', params.id)
                .order('date', { ascending: true });

            if (coursesError) throw coursesError;
            setCourses(coursesData || []);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'No se pudieron cargar los datos',
                variant: 'destructive'
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchYearAndCourses();
    }, [params.id]);

    const handleCourseCreated = () => {
        fetchYearAndCourses();
        setIsCreateModalOpen(false);
        toast({
            title: 'Exito',
            description: 'Curso creado exitosamente',
        });
    };

    if (isLoading) {
        return (
            <div className='min-h-screen p-8'>
                <div className='max-w-7xl mx-auto'>
                    <div className='animate-pulse space-y-4'>
                        <div className='h-8 bg-muted rounded w-64'>
                            <div className='h-12 bg-muted rounded w-96'>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!year) return null;

    return (
        <div className='min-h-screen p-8'>
            <div className='max-w-7xl mx-auto'>
                <div className='flex items-center gap-2 text-sm text muted-foreground mb-6'>
                    <Link href="/" className='hover:text-foreground transition-colors'>
                        Capacitaciones
                    </Link>
                    <ChevronRight className='w-4 h-4' />
                    <span className='text-foreground font-medium'>{year.year}</span>
                </div>

                <div className='flex items-start justify-between mb-8'>
                    <div>
                        <h1 className='text-4xl font-bold text-foreground mb-2'>
                            Capacitaciones {year.year}
                        </h1>
                        <p className='text-muted-foreground text-lg'>
                            Gestión de cursos del año {year.year}
                        </p>
                    </div>

                    <Button
                        onClick={() => setIsCreateModalOpen(true)}
                        className='bg-[#2166be] hover:bg-[#1a5299] text-white'
                        size="lg"
                    >
                        <Plus className='w-5 h-5 mr-2' />
                        Crear curso
                    </Button>
                </div>

                {courses.length === 0 ? (
                    <div className='text-center py-16'>
                        <div className='inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4'>
                            <Plus className='w-8 h-8 text-muted-foreground' />
                        </div>
                        <h3 className='text-xl font-semibold text-foreground mb-2'>
                            No hay cursos creados para este año
                        </h3>
                        <p className='text-muted-foreground mb-6'>
                            Comienza creando tu primer curso de capacitación
                        </p>
                        <Button
                            onClick={() => setIsCreateModalOpen(true)}
                            className='bg-[#2166be] hover:bg-[#1a5299] text-white'
                        >
                            <Plus className='w-5 h-5 mr-2' />
                            Crear curso
                        </Button>
                    </div>
                ) : (
                    <div className='space-y-4'>
                        {courses.map((course) => (
                            <CourseCard key={course.id} course={course} />
                        ))}
                    </div>
                )}
                <CreateCourseModal
                    open={isCreateModalOpen}
                    onOpenChange={setIsCreateModalOpen}
                    onCourseCreated={handleCourseCreated}
                    yearId={params.id as string}
                />
            </div>

        </div>
    );
}