import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontSize: 10,
        fontFamily: 'Helvetica',
    },
    header: {
        marginBottom: 30,
        borderBottom: '2 solid #1e293b',
        paddingBottom: 15,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 12,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 4,
    },
    courseInfo: {
        marginBottom: 20,
        padding: 15,
        backgroundColor: '#f8fafc',
        borderRadius: 4,
    },
    infoRow: {
        flexDirection: 'row',
        marginBottom: 6,
    },
    infoLabel: {
        fontSize: 10,
        color: '#64748b',
        width: '30%',
        fontWeight: 'bold',
    },
    infoValue: {
        fontSize: 10,
        color: '#1e293b',
        width: '70%',
    },
    table: {
        width: '100%',
        marginTop: 10,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#1e293b',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 4,
    },
    tableHeaderCell: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottom: '1 solid #e2e8f0',
        paddingVertical: 12,
        paddingHorizontal: 8,
        minHeight: 50,
    },
    tableCell: {
        fontSize: 9,
        color: '#334155',
    },
    col1: { width: '8%' },
    col2: { width: '15%' },
    col3: { width: '30%' },
    col4: { width: '20%' },
    col5: { width: '15%' },
    col6: { width: '12%' },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 40,
        right: 40,
        textAlign: 'center',
        color: '#94a3b8',
        fontSize: 8,
        borderTop: '1 solid #e2e8f0',
        paddingTop: 10,
    },
});

interface AttendanceListPDFProps {
    course: {
        name: string;
        date: string;
        duration_hours: number;
    };
    participants: Array<{
        employee_number: string;
        nombre: string;
        area: string;
        puesto: string;
    }>;
}

export function AttendanceListPDF({ course, participants }: AttendanceListPDFProps) {
    const formatDate = (dateString: string) => {
        if (!dateString || typeof dateString !== 'string') return String(dateString || '');
        try {
            
            const str = String(dateString);
            const [year, month, day] = str.split('-');
            const monthNames = [
                'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
            ];
            
            if (!year || !month || !day) return str;

            const monthIndex = parseInt(month, 10) - 1;
            const monthName = monthNames[monthIndex] || month;
            return `${parseInt(day, 10)} de ${monthName} de ${year}`;
        } catch (e) {
            console.error('Error formatting date:', e);
            return String(dateString);
        }
    };

    const currentDate = new Date();
    const currentDateStr = `${currentDate.getDate()}/${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`;
    const currentTimeStr = `${currentDate.getHours()}:${String(currentDate.getMinutes()).padStart(2, '0')}`;

    return (
        <Document>
            <Page size="A4" style={styles.page} orientation="landscape">
                <View style={styles.header}>
                    <Text style={styles.title}>LISTA DE ASISTENCIA</Text>
                    <Text style={styles.subtitle}>Control de Participantes del Curso</Text>
                </View>

                <View style={styles.courseInfo}>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Nombre del Curso:</Text>
                        <Text style={styles.infoValue}>{String(course?.name || '')}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Fecha:</Text>
                        <Text style={styles.infoValue}>{formatDate(course?.date)}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Duración:</Text>
                        <Text style={styles.infoValue}>{String(course?.duration_hours || '')} horas</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Total Participantes:</Text>
                        <Text style={styles.infoValue}>{String(participants?.length || 0)}</Text>
                    </View>
                </View>

                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, styles.col1]}>#</Text>
                        <Text style={[styles.tableHeaderCell, styles.col2]}>N° Empleado</Text>
                        <Text style={[styles.tableHeaderCell, styles.col3]}>Nombre Completo</Text>
                        <Text style={[styles.tableHeaderCell, styles.col4]}>Área</Text>
                        <Text style={[styles.tableHeaderCell, styles.col5]}>Puesto</Text>
                        <Text style={[styles.tableHeaderCell, styles.col6]}>Firma</Text>
                    </View>

                    {participants?.map((participant, index) => (
                        <View key={index} style={styles.tableRow}>
                            <Text style={[styles.tableCell, styles.col1]}>{index + 1}</Text>
                            <Text style={[styles.tableCell, styles.col2]}>{String(participant.employee_number || '')}</Text>
                            <Text style={[styles.tableCell, styles.col3]}>{String(participant.nombre || '')}</Text>
                            <Text style={[styles.tableCell, styles.col4]}>{String(participant.area || '')}</Text>
                            <Text style={[styles.tableCell, styles.col5]}>{String(participant.puesto || '')}</Text>
                            <Text style={[styles.tableCell, styles.col6]}></Text>
                        </View>
                    ))}
                </View>

                <Text style={styles.footer}>
                    Documento generado el {currentDateStr} a las {currentTimeStr}
                </Text>
            </Page>
        </Document>
    );
}
