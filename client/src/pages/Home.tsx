import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import {
  Building2, ShieldCheck, ArrowRightLeft, Wallet, BadgeCheck, GitBranch,
  ChevronRight, Heart,
} from "lucide-react";
import { useEffect } from "react";

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user && !loading) {
      setLocation("/dashboard");
    }
  }, [user, loading, setLocation]);

  if (loading) return null;

  const features = [
    { icon: Wallet, title: "กระเป๋าสุขภาพ", desc: "เก็บข้อมูลสุขภาพในรูปแบบ Health Card ที่ปลอดภัย" },
    { icon: BadgeCheck, title: "ใบรับรองดิจิทัล", desc: "ออกและตรวจสอบ Verifiable Credential ตามมาตรฐาน" },
    { icon: ArrowRightLeft, title: "ส่งต่อผู้ป่วย", desc: "ระบบส่งต่อแบบ Closed-loop พร้อมติดตามสถานะ" },
    { icon: ShieldCheck, title: "ความยินยอม PDPA", desc: "จัดการความยินยอมตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล" },
    { icon: GitBranch, title: "มาตรฐาน FHIR", desc: "แปลงข้อมูลให้เป็นมาตรฐาน HL7 FHIR R4 อัตโนมัติ" },
    { icon: Building2, title: "เครือข่ายโรงพยาบาล", desc: "รองรับหลายโรงพยาบาลในเครือเดียวกัน" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/3">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Heart className="h-5 w-5 text-primary" />
            </div>
            <span className="font-semibold text-lg tracking-tight">Trustcare</span>
          </div>
          <Button onClick={() => { window.location.href = getLoginUrl(); }}>
            เข้าสู่ระบบ
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="container py-20 md:py-32">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            ระบบจัดการข้อมูลสุขภาพ
            <br />
            <span className="text-primary">เครือโรงพยาบาล Trustcare</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            แพลตฟอร์มแลกเปลี่ยนข้อมูลสุขภาพที่ปลอดภัย ด้วยเทคโนโลยี Verifiable Credential
            และมาตรฐาน FHIR รองรับการส่งต่อผู้ป่วยแบบไร้รอยต่อ
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Button size="lg" onClick={() => { window.location.href = getLoginUrl(); }}>
              เริ่มต้นใช้งาน
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline">
              เรียนรู้เพิ่มเติม
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <Card key={i} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium mb-1">{f.title}</h3>
                    <p className="text-sm text-muted-foreground">{f.desc}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container text-center text-sm text-muted-foreground">
          <p>&copy; 2024 Trustcare Hospital Network. ระบบจัดการข้อมูลสุขภาพเครือโรงพยาบาล</p>
        </div>
      </footer>
    </div>
  );
}
