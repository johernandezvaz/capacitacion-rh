
import React from 'react';
import { NextResponse } from 'next/server';
import { renderToBuffer, Document, Page, Text, View } from '@react-pdf/renderer';

const MyDoc = () => (
    <Document>
        <Page>
            <View>
                <Text>Section #1</Text>
            </View>
            <View>
                <Text>Section #2</Text>
            </View>
        </Page>
    </Document>
);

export async function GET() {
    try {
        console.log("Starting PDF generation test");
        const buffer = await renderToBuffer(<MyDoc />);
        console.log("PDF generated, size:", buffer.length);

        return new NextResponse(buffer as unknown as BodyInit, {
            headers: {
                'Content-Type': 'application/pdf',
            },
        });
    } catch (error: any) {
        console.error('Error generating PDF:', error);
        return NextResponse.json(
            { error: error?.message, stack: error?.stack },
            { status: 500 }
        );
    }
}
