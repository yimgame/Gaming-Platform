import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, X, Calendar, HardDrive, ZoomIn } from "lucide-react";
import { useState } from "react";

interface Screenshot {
  filename: string;
  url: string;
  timestamp?: string;
  size?: number;
}

async function fetchScreenshots(page: number = 1, limit: number = 20) {
  const response = await fetch(`/api/screenshots?page=${page}&limit=${limit}`);
  
  if (!response.ok) {
    throw new Error("Failed to fetch screenshots");
  }
  
  return response.json();
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateString?: string): string {
  if (!dateString) return 'Desconocido';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ScreenshotsGallery() {
  const [selectedImage, setSelectedImage] = useState<Screenshot | null>(null);
  const [page, setPage] = useState(1);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["screenshots", page],
    queryFn: () => fetchScreenshots(page, 24),
  });

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/4 mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="aspect-video bg-muted rounded" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="p-6">
        <p className="text-destructive">Error cargando las imágenes</p>
      </Card>
    );
  }

  const { screenshots, total, totalPages } = data;

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center">
            <Camera className="w-6 h-6 mr-2 text-primary" />
            Galería de Screenshots
          </h2>
          <Badge variant="outline" className="text-sm">
            {total} imágenes
          </Badge>
        </div>

        {screenshots.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No hay screenshots disponibles</p>
          </div>
        ) : (
          <>
            {/* Grid de screenshots */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {screenshots.map((screenshot: Screenshot) => (
                <div
                  key={screenshot.filename}
                  className="group relative aspect-video overflow-hidden rounded-lg border-2 border-primary/20 hover:border-primary/60 transition-all duration-300 cursor-pointer"
                  onClick={() => setSelectedImage(screenshot)}
                >
                  <img
                    src={screenshot.url}
                    alt={screenshot.filename}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                  
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-white text-xs font-semibold truncate mb-1">
                        {screenshot.filename}
                      </p>
                      {screenshot.timestamp && (
                        <p className="text-white/70 text-xs flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(screenshot.timestamp)}
                        </p>
                      )}
                    </div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                      <div className="bg-primary/90 rounded-full p-3">
                        <ZoomIn className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Anterior
                </Button>
                
                <div className="flex items-center gap-2">
                  {[...Array(totalPages)].map((_, i) => {
                    const pageNum = i + 1;
                    // Mostrar solo páginas cercanas a la actual
                    if (
                      pageNum === 1 ||
                      pageNum === totalPages ||
                      (pageNum >= page - 2 && pageNum <= page + 2)
                    ) {
                      return (
                        <Button
                          key={pageNum}
                          variant={page === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setPage(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    } else if (pageNum === page - 3 || pageNum === page + 3) {
                      return <span key={pageNum} className="px-2">...</span>;
                    }
                    return null;
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Modal de imagen en grande */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-6xl p-0">
          {selectedImage && (
            <>
              <DialogHeader className="p-6 pb-0">
                <DialogTitle className="flex items-center justify-between">
                  <span className="truncate mr-4">{selectedImage.filename}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedImage(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </DialogTitle>
              </DialogHeader>
              
              <div className="p-6 pt-4">
                <img
                  src={selectedImage.url}
                  alt={selectedImage.filename}
                  className="w-full h-auto rounded-lg"
                />
                
                <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                  {selectedImage.timestamp && (
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      {formatDate(selectedImage.timestamp)}
                    </div>
                  )}
                  {selectedImage.size && (
                    <div className="flex items-center">
                      <HardDrive className="w-4 h-4 mr-2" />
                      {formatFileSize(selectedImage.size)}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
