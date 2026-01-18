import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

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
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 4,
    },
    section: {
        marginBottom: 25,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 12,
        borderBottom: '1 solid #e2e8f0',
        paddingBottom: 6,
    },
    infoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 10,
    },
    infoItem: {
        width: '50%',
        marginBottom: 8,
    },
    infoLabel: {
        fontSize: 9,
        color: '#64748b',
        marginBottom: 2,
    },
    infoValue: {
        fontSize: 11,
        color: '#1e293b',
        fontWeight: 'bold',
    },
    table: {
        width: '100%',
        marginTop: 10,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#f1f5f9',
        borderBottom: '2 solid #cbd5e1',
        paddingVertical: 8,
        paddingHorizontal: 5,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottom: '1 solid #e2e8f0',
        paddingVertical: 8,
        paddingHorizontal: 5,
    },
    tableHeaderCell: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    tableCell: {
        fontSize: 9,
        color: '#334155',
    },
    col1: { width: '12%' },
    col2: { width: '22%' },
    col3: { width: '18%' },
    col4: { width: '18%' },
    col5: { width: '15%' },
    col6: { width: '15%' },
    averageBox: {
        backgroundColor: '#f8fafc',
        padding: 15,
        borderRadius: 4,
        border: '1 solid #cbd5e1',
        marginTop: 10,
    },
    averageRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    averageLabel: {
        fontSize: 11,
        color: '#475569',
    },
    averageValue: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    pending: {
        color: '#94a3b8',
        fontStyle: 'italic',
    },
    logoContainer: {
        marginTop: 40,
        alignItems: 'center',
        paddingTop: 30,
        borderTop: '1 solid #e2e8f0',
    },
    logo: {
        width: 150,
        height: 'auto',
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 40,
        right: 40,
        textAlign: 'center',
        fontSize: 8,
        color: '#94a3b8',
    },
});

interface Participant {
    employee_number: string;
    nombre: string;
    area: string;
    puesto: string;
    hot_score: number | null;
    cold_score: number | null;
}

interface CourseReportData {
    courseName: string;
    courseDate: string;
    courseDuration: number;
    totalParticipants: number;
    participants: Participant[];
    averageScore: number | null;
    reportType: 'hot' | 'cold';
    logoBase64: string;
}

export const CourseReportPDF = ({ data }: { data: CourseReportData }) => {
    const formatScore = (score: number | null): string => {
        if (score === null) return 'Pendiente';
        return `${score.toFixed(2)}%`;
    };

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <View style={styles.header}>
                    <Text style={styles.title}>
                        Reporte {data.reportType === 'hot' ? 'Caliente' : 'Frío'} de Capacitación
                    </Text>
                    <Text style={styles.subtitle}>{data.courseName}</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Información General del Curso</Text>
                    <View style={styles.infoGrid}>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>Nombre del curso</Text>
                            <Text style={styles.infoValue}>{data.courseName}</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>Fecha del curso</Text>
                            <Text style={styles.infoValue}>{formatDate(data.courseDate)}</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>Duración</Text>
                            <Text style={styles.infoValue}>{data.courseDuration} horas</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Text style={styles.infoLabel}>Total de participantes</Text>
                            <Text style={styles.infoValue}>{data.totalParticipants}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Participantes y Resultados Individuales</Text>
                    <View style={styles.table}>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.tableHeaderCell, styles.col1]}>No. Emp</Text>
                            <Text style={[styles.tableHeaderCell, styles.col2]}>Nombre</Text>
                            <Text style={[styles.tableHeaderCell, styles.col3]}>Área</Text>
                            <Text style={[styles.tableHeaderCell, styles.col4]}>Puesto</Text>
                            <Text style={[styles.tableHeaderCell, styles.col5]}>Calificación</Text>
                        </View>
                        {data.participants.map((participant, index) => {
                            const score = data.reportType === 'hot' ? participant.hot_score : participant.cold_score;
                            return (
                                <View key={index} style={styles.tableRow}>
                                    <Text style={[styles.tableCell, styles.col1]}>
                                        {participant.employee_number}
                                    </Text>
                                    <Text style={[styles.tableCell, styles.col2]}>
                                        {participant.nombre}
                                    </Text>
                                    <Text style={[styles.tableCell, styles.col3]}>
                                        {participant.area}
                                    </Text>
                                    <Text style={[styles.tableCell, styles.col4]}>
                                        {participant.puesto}
                                    </Text>
                                    <Text style={[
                                        styles.tableCell,
                                        styles.col5,
                                        score === null ? styles.pending : {}
                                    ]}>
                                        {formatScore(score)}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Resultados Generales del Curso</Text>
                    <View style={styles.averageBox}>
                        <View style={styles.averageRow}>
                            <Text style={styles.averageLabel}>
                                Promedio General - Cuestionario {data.reportType === 'hot' ? 'Caliente' : 'Frío'}:
                            </Text>
                            <Text style={styles.averageValue}>{formatScore(data.averageScore)}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.logoContainer}>
                    {data.logoBase64 && (
                        <Image
                            style={styles.logo}
                            src={data.logoBase64}
                        />
                    )}
                </View>

                <Text style={styles.footer}>
                    Generado el {new Date().toLocaleDateString('es-MX')} a las {new Date().toLocaleTimeString('es-MX')}
                </Text>
            </Page>
        </Document>
    );
};
